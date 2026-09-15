import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabaseClient', () => ({ serviceRoleSupabase: {} }))

import { processMobileNotificationOutbox, redactMobilePushError } from './processMobileNotificationOutbox'

const NOW = new Date('2026-09-08T01:00:00.000Z')
const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OUTBOX_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const LOCK_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function outboxRow(overrides: Record<string, unknown> = {}) {
    return {
        id: OUTBOX_ID,
        recipient_user_id: USER_ID,
        kind: 'chat_message',
        payload: {
            kind: 'chat_message',
            roomId: '11111111-1111-4111-8111-111111111111',
            messageId: '22222222-2222-4222-8222-222222222222',
            privateText: 'must not be sent',
        },
        status: 'processing',
        delivery_stage: 'send',
        attempt_count: 1,
        receipt_attempt_count: 0,
        target_installation_ids: null,
        expo_ticket_map: [],
        delivered_count: 0,
        lock_token: LOCK_ID,
        ...overrides,
    }
}

type FakeDbOptions = {
    rows?: Record<string, unknown>[]
    installations?: { id: string; push_token: string }[]
}

function fakeDb(options: FakeDbOptions = {}) {
    const outboxUpdates: Record<string, unknown>[] = []
    const installationUpdates: Record<string, unknown>[] = []
    const rpc = vi.fn().mockResolvedValue({ data: options.rows || [], error: null })
    const from = vi.fn((table: string) => {
        let operation: 'select' | 'update' | null = null
        let updateValues: Record<string, unknown> | null = null
        const builder: any = {
            select: vi.fn(() => {
                operation ||= 'select'
                return builder
            }),
            update: vi.fn((values: Record<string, unknown>) => {
                operation = 'update'
                updateValues = values
                if (table === 'mobile_notification_outbox') outboxUpdates.push(values)
                if (table === 'mobile_push_installations') installationUpdates.push(values)
                return builder
            }),
            eq: vi.fn(() => builder),
            in: vi.fn(() => builder),
            maybeSingle: vi.fn(async () => ({ data: { id: OUTBOX_ID }, error: null })),
            then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
                const result = table === 'mobile_push_installations' && operation === 'select'
                    ? { data: options.installations || [], error: null }
                    : { data: updateValues ? { id: OUTBOX_ID } : null, error: null }
                return Promise.resolve(result).then(resolve, reject)
            },
        }
        return builder
    })
    return { db: { rpc, from }, rpc, from, outboxUpdates, installationUpdates }
}

function expoResponse(data: unknown, status = 200) {
    return new Response(JSON.stringify({ data }), {
        status,
        headers: { 'content-type': 'application/json' },
    })
}

describe('processMobileNotificationOutbox', () => {
    it('claims work atomically through the database RPC and clamps invalid limits', async () => {
        const state = fakeDb()
        const result = await processMobileNotificationOutbox(Number.NaN, {
            db: state.db,
            fetchImpl: vi.fn(),
            now: () => NOW,
            expoAccessToken: '',
        })

        expect(result.selected).toBe(0)
        expect(state.rpc).toHaveBeenCalledWith('claim_mobile_notification_outbox', {
            p_limit: 50,
            p_lease_seconds: 300,
        })
        expect(state.from).not.toHaveBeenCalled()
    })

    it('retries only rejected devices after a partial ticket batch and redacts payload data', async () => {
        const installations = [
            { id: '10000000-0000-4000-8000-000000000001', push_token: 'ExpoPushToken[token-one]' },
            { id: '10000000-0000-4000-8000-000000000002', push_token: 'ExpoPushToken[token-two]' },
            { id: '10000000-0000-4000-8000-000000000003', push_token: 'ExpoPushToken[token-three]' },
        ]
        const state = fakeDb({ rows: [outboxRow()], installations })
        const fetchImpl = vi.fn().mockResolvedValue(expoResponse([
            { status: 'ok', id: 'ticket-1' },
            { status: 'error', details: { error: 'DeviceNotRegistered' } },
            { status: 'error', message: 'slow down', details: { error: 'MessageRateExceeded' } },
        ]))

        const result = await processMobileNotificationOutbox(50, {
            db: state.db,
            fetchImpl: fetchImpl as typeof fetch,
            now: () => NOW,
            expoAccessToken: '',
        })

        expect(result.retried).toBe(1)
        const finalUpdate = state.outboxUpdates.at(-1)!
        expect(finalUpdate.status).toBe('retry')
        expect(finalUpdate.target_installation_ids).toEqual([installations[2].id])
        expect(finalUpdate.expo_ticket_map).toEqual([
            { ticketId: 'ticket-1', installationId: installations[0].id },
        ])
        expect(state.installationUpdates).toContainEqual(expect.objectContaining({
            enabled: false,
            last_error_code: 'DeviceNotRegistered',
        }))
        const sentMessages = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))
        expect(sentMessages[0].data).toEqual({
            kind: 'chat_message',
            roomId: '11111111-1111-4111-8111-111111111111',
            messageId: '22222222-2222-4222-8222-222222222222',
        })
        expect(JSON.stringify(sentMessages)).not.toContain('privateText')
    })

    it('checks receipts and invalidates DeviceNotRegistered without resending a delivered device', async () => {
        const firstInstallation = '10000000-0000-4000-8000-000000000001'
        const secondInstallation = '10000000-0000-4000-8000-000000000002'
        const state = fakeDb({
            rows: [outboxRow({
                delivery_stage: 'receipt',
                attempt_count: 1,
                expo_ticket_map: [
                    { ticketId: 'ticket-ok', installationId: firstInstallation },
                    { ticketId: 'ticket-invalid', installationId: secondInstallation },
                ],
            })],
        })
        const fetchImpl = vi.fn().mockResolvedValue(expoResponse({
            'ticket-ok': { status: 'ok' },
            'ticket-invalid': { status: 'error', details: { error: 'DeviceNotRegistered' } },
        }))

        const result = await processMobileNotificationOutbox(50, {
            db: state.db,
            fetchImpl: fetchImpl as typeof fetch,
            now: () => NOW,
            expoAccessToken: '',
        })

        expect(result.sent).toBe(1)
        expect(fetchImpl).toHaveBeenCalledTimes(1)
        expect(String(fetchImpl.mock.calls[0][0])).toContain('getReceipts')
        expect(state.installationUpdates).toContainEqual(expect.objectContaining({
            enabled: false,
            last_error_code: 'DeviceNotRegistered',
        }))
        expect(state.outboxUpdates.at(-1)).toEqual(expect.objectContaining({
            status: 'sent',
            delivered_count: 1,
            expo_ticket_map: [],
        }))
    })

    it('does not retry terminal Expo ticket errors such as MessageTooBig', async () => {
        const state = fakeDb({
            rows: [outboxRow()],
            installations: [{
                id: '10000000-0000-4000-8000-000000000001',
                push_token: 'ExpoPushToken[token-one]',
            }],
        })
        const fetchImpl = vi.fn().mockResolvedValue(expoResponse([{
            status: 'error',
            message: 'payload rejected',
            details: { error: 'MessageTooBig' },
        }]))

        const result = await processMobileNotificationOutbox(50, {
            db: state.db,
            fetchImpl: fetchImpl as typeof fetch,
            now: () => NOW,
            expoAccessToken: '',
        })

        expect(result.failed).toBe(1)
        expect(state.outboxUpdates.at(-1)).toEqual(expect.objectContaining({
            status: 'failed',
            target_installation_ids: [],
        }))
    })

    it('redacts both Expo token formats before an error is persisted or logged', () => {
        expect(redactMobilePushError(
            'bad ExpoPushToken[secret-one] and ExponentPushToken[secret-two]',
        )).toBe('bad [redacted-token] and [redacted-token]')
    })

    it('keeps registration and queue claiming atomic in the migration contract', () => {
        const sql = readFileSync(resolve(
            process.cwd(),
            'supabase/migrations/20260908090000_mobile_push_installations.sql',
        ), 'utf8')
        expect(sql).toContain("pg_advisory_xact_lock(hashtextextended('coachlink-mobile-push-registration', 0))")
        expect(sql).toContain('FOR UPDATE SKIP LOCKED')
        expect(sql).toContain('lock_token = gen_random_uuid()')
        expect(sql).toContain("status IN ('pending', 'retry', 'receipt_pending')")
        expect(sql).toContain('REVOKE ALL ON TABLE public.mobile_push_installations FROM PUBLIC, anon, authenticated')
    })
})
