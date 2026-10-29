import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabaseClient', () => ({ serviceRoleSupabase: {} }))

import { enqueueAnnouncementMobilePush } from './enqueueAnnouncementMobilePush'
import type { AnnouncementRow } from './announcements'

const NOW = new Date('2026-10-27T08:00:00.000Z')
const ANNOUNCEMENT_ID = '44444444-4444-4444-8444-444444444444'
const COACH = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const STUDENT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function announcement(overrides: Partial<AnnouncementRow> = {}): AnnouncementRow {
    return {
        id: ANNOUNCEMENT_ID,
        title: '新功能上线',
        summary: '',
        content: '',
        cover_image_url: null,
        image_urls: [],
        action_label: '',
        weapp_path: '',
        web_path: '',
        audience: 'all',
        status: 'published',
        popup: true,
        pinned: false,
        published_at: '2026-10-27T07:00:00.000Z',
        expires_at: null,
        created_at: '2026-10-27T06:00:00.000Z',
        updated_at: '2026-10-27T07:00:00.000Z',
        ...overrides,
    }
}

function fakeDb() {
    const upserts: Array<{ rows: any[]; options: unknown }> = []
    const from = vi.fn((table: string) => {
        const builder: any = {
            select: vi.fn(() => builder),
            eq: vi.fn(() => builder),
            order: vi.fn(() => builder),
            range: vi.fn(async () => ({
                data: [{ user_id: COACH }, { user_id: STUDENT }, { user_id: COACH }],
                error: null,
            })),
            in: vi.fn(async () => ({
                data: [{ id: COACH, is_coach: true }, { id: STUDENT, is_coach: false }],
                error: null,
            })),
            upsert: vi.fn(async (rows: any[], options: unknown) => {
                if (table === 'mobile_notification_outbox') upserts.push({ rows, options })
                return { error: null }
            }),
        }
        return builder
    })
    return { db: { from }, from, upserts }
}

describe('enqueueAnnouncementMobilePush', () => {
    it('queues one deduplicated push per enabled user', async () => {
        const state = fakeDb()
        await expect(enqueueAnnouncementMobilePush(announcement(), { db: state.db, now: NOW })).resolves.toBe(2)
        expect(state.upserts).toHaveLength(1)
        expect(state.upserts[0].options).toEqual({ onConflict: 'dedupe_key', ignoreDuplicates: true })
        expect(state.upserts[0].rows).toEqual([
            {
                recipient_user_id: COACH,
                kind: 'announcement',
                dedupe_key: `announcement:${ANNOUNCEMENT_ID}:${COACH}`,
                payload: { kind: 'announcement', announcementId: ANNOUNCEMENT_ID },
            },
            expect.objectContaining({ recipient_user_id: STUDENT, dedupe_key: `announcement:${ANNOUNCEMENT_ID}:${STUDENT}` }),
        ])
    })

    it('respects the audience', async () => {
        const state = fakeDb()
        await expect(enqueueAnnouncementMobilePush(announcement({ audience: 'coach' }), { db: state.db, now: NOW })).resolves.toBe(1)
        expect(state.upserts[0].rows.map((row) => row.recipient_user_id)).toEqual([COACH])
    })

    it('skips non-popup, unpublished and expired announcements', async () => {
        const state = fakeDb()
        await expect(enqueueAnnouncementMobilePush(announcement({ popup: false }), { db: state.db, now: NOW })).resolves.toBe(0)
        await expect(enqueueAnnouncementMobilePush(announcement({ status: 'draft' }), { db: state.db, now: NOW })).resolves.toBe(0)
        await expect(enqueueAnnouncementMobilePush(announcement({ expires_at: '2026-10-27T07:30:00.000Z' }), { db: state.db, now: NOW })).resolves.toBe(0)
        expect(state.from).not.toHaveBeenCalled()
    })
})
