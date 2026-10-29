import { serviceRoleSupabase } from '@/lib/supabaseClient'
import { loadPushContent } from '@/lib/mobileNotificationContent'

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send'
const EXPO_RECEIPTS_ENDPOINT = 'https://exp.host/--/api/v2/push/getReceipts'
const EXPO_PUSH_TOKEN_PATTERN = /^(?:ExpoPushToken|ExponentPushToken)\[[^\]]{8,512}\]$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_SEND_ATTEMPTS = 5
const MAX_RECEIPT_ATTEMPTS = 8
const SEND_BATCH_SIZE = 100
const RECEIPT_BATCH_SIZE = 1000
const CLAIM_LEASE_SECONDS = 300
const TERMINAL_EXPO_ERRORS = new Set(['InvalidCredentials', 'MessageTooBig', 'MismatchSenderId'])

type DeliveryStage = 'send' | 'receipt'

type TicketMapEntry = {
    ticketId: string
    installationId: string
}

type OutboxRow = {
    id: string
    recipient_user_id: string
    kind: string
    payload: Record<string, unknown> | null
    status: string
    delivery_stage: DeliveryStage
    attempt_count: number
    receipt_attempt_count: number
    target_installation_ids: string[] | null
    expo_ticket_map: unknown
    delivered_count: number
    lock_token: string
}

type InstallationRow = {
    id: string
    push_token: string
}

type ExpoDeliveryResult = {
    status?: 'ok' | 'error'
    id?: string
    message?: string
    details?: { error?: string }
}

type ProcessorDependencies = {
    db: any
    fetchImpl: typeof fetch
    now: () => Date
    expoAccessToken: string
}

type RowResult = 'sent' | 'retried' | 'failed' | 'skipped' | 'receipt_pending'

function clampLimit(value: number) {
    if (!Number.isFinite(value)) return 50
    return Math.min(Math.max(Math.trunc(value), 1), 100)
}

function retryAt(attempt: number, now: () => Date) {
    const delaySeconds = Math.min(3600, 30 * (2 ** Math.max(0, attempt - 1)))
    return new Date(now().getTime() + delaySeconds * 1000).toISOString()
}

function receiptRetryAt(attempt: number, now: () => Date) {
    const delaySeconds = Math.min(6 * 3600, 15 * 60 * (2 ** Math.max(0, attempt - 1)))
    return new Date(now().getTime() + delaySeconds * 1000).toISOString()
}

export function redactMobilePushError(value: unknown) {
    const text = value instanceof Error ? value.message : String(value || 'unknown error')
    return text
        .replace(/(?:ExpoPushToken|ExponentPushToken)\[[^\]]+\]/g, '[redacted-token]')
        .slice(0, 500)
}

function chunks<T>(values: T[], size: number) {
    const result: T[][] = []
    for (let index = 0; index < values.length; index += size) {
        result.push(values.slice(index, index + size))
    }
    return result
}

function unique(values: string[]) {
    return [...new Set(values)]
}

function isTerminalExpoError(errorCode: string) {
    return TERMINAL_EXPO_ERRORS.has(errorCode)
}

function parseTicketMap(value: unknown): TicketMapEntry[] {
    if (!Array.isArray(value)) return []
    const seen = new Set<string>()
    return value.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return []
        const ticketId = typeof (entry as any).ticketId === 'string' ? (entry as any).ticketId.trim() : ''
        const installationId = typeof (entry as any).installationId === 'string'
            ? (entry as any).installationId.trim()
            : ''
        if (!ticketId || !UUID_PATTERN.test(installationId) || seen.has(ticketId)) return []
        seen.add(ticketId)
        return [{ ticketId, installationId }]
    })
}

function appendTicketMap(current: TicketMapEntry[], additions: TicketMapEntry[]) {
    return parseTicketMap([...current, ...additions])
}

function safeNotificationData(row: OutboxRow) {
    if (row.kind === 'chat_message') {
        const roomId = typeof row.payload?.roomId === 'string' && UUID_PATTERN.test(row.payload.roomId)
            ? row.payload.roomId
            : undefined
        const messageId = typeof row.payload?.messageId === 'string' && UUID_PATTERN.test(row.payload.messageId)
            ? row.payload.messageId
            : undefined
        return {
            kind: 'chat_message',
            ...(roomId ? { roomId } : {}),
            ...(messageId ? { messageId } : {}),
        }
    }
    if (row.kind === 'announcement') {
        const announcementId = typeof row.payload?.announcementId === 'string' && UUID_PATTERN.test(row.payload.announcementId)
            ? row.payload.announcementId
            : undefined
        return { kind: 'announcement', ...(announcementId ? { announcementId } : {}) }
    }
    // Do not forward arbitrary database JSON to a lock-screen notification.
    return { kind: row.kind.slice(0, 64) }
}

function expoHeaders(accessToken: string) {
    return {
        accept: 'application/json',
        'content-type': 'application/json',
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    }
}

async function parseExpoResponse<T>(response: Response, shape: 'array' | 'object'): Promise<T> {
    const body = await response.json().catch(() => null) as { data?: unknown } | null
    const validData = shape === 'array' ? Array.isArray(body?.data) : Boolean(body?.data && typeof body.data === 'object')
    if (!response.ok || !validData) {
        throw new Error(`Expo Push HTTP ${response.status}`)
    }
    return body!.data as T
}

async function mutateInstallations(
    db: any,
    ids: string[],
    values: Record<string, unknown>,
) {
    if (!ids.length) return
    const { error } = await db
        .from('mobile_push_installations')
        .update(values)
        .in('id', unique(ids))
    if (error) throw new Error(`更新移动推送设备失败: ${error.message}`)
}

async function finishClaim(
    db: any,
    row: OutboxRow,
    values: Record<string, unknown>,
) {
    const { data, error } = await db
        .from('mobile_notification_outbox')
        .update({
            ...values,
            lock_token: null,
            locked_at: null,
        })
        .eq('id', row.id)
        .eq('lock_token', row.lock_token)
        .select('id')
        .maybeSingle()
    if (error) throw new Error(`更新移动通知队列失败: ${error.message}`)
    return Boolean(data)
}

async function checkpointClaim(
    db: any,
    row: OutboxRow,
    values: Record<string, unknown>,
) {
    const { data, error } = await db
        .from('mobile_notification_outbox')
        .update(values)
        .eq('id', row.id)
        .eq('lock_token', row.lock_token)
        .select('id')
        .maybeSingle()
    if (error) throw new Error(`保存移动通知处理进度失败: ${error.message}`)
    return Boolean(data)
}

async function loadInstallations(db: any, row: OutboxRow): Promise<InstallationRow[]> {
    let query = db
        .from('mobile_push_installations')
        .select('id, push_token')
        .eq('user_id', row.recipient_user_id)
        .eq('provider', 'expo')
        .eq('enabled', true)
    if (Array.isArray(row.target_installation_ids)) {
        if (!row.target_installation_ids.length) return []
        query = query.in('id', unique(row.target_installation_ids))
    }
    const { data, error } = await query
    if (error) throw new Error(`读取移动推送设备失败: ${error.message}`)
    return (data || []) as InstallationRow[]
}

async function scheduleSendFailure(
    row: OutboxRow,
    error: unknown,
    dependencies: ProcessorDependencies,
) : Promise<RowResult> {
    const existingTickets = parseTicketMap(row.expo_ticket_map)
    const terminal = row.attempt_count >= MAX_SEND_ATTEMPTS
    if (terminal && existingTickets.length) {
        const updated = await finishClaim(dependencies.db, row, {
            status: 'receipt_pending',
            delivery_stage: 'receipt',
            target_installation_ids: [],
            next_attempt_at: receiptRetryAt(1, dependencies.now),
            last_error: redactMobilePushError(error),
            processed_at: null,
        })
        return updated ? 'receipt_pending' : 'skipped'
    }
    const updated = await finishClaim(dependencies.db, row, {
        status: terminal ? 'failed' : 'retry',
        delivery_stage: 'send',
        next_attempt_at: retryAt(row.attempt_count, dependencies.now),
        last_error: redactMobilePushError(error),
        processed_at: terminal ? dependencies.now().toISOString() : null,
    })
    if (!updated) return 'skipped'
    return terminal ? 'failed' : 'retried'
}

async function processSendRow(row: OutboxRow, dependencies: ProcessorDependencies): Promise<RowResult> {
    const { db, fetchImpl, now, expoAccessToken } = dependencies
    const priorTickets = parseTicketMap(row.expo_ticket_map)
    const installations = await loadInstallations(db, row)
    const malformedIds = installations
        .filter((installation) => !EXPO_PUSH_TOKEN_PATTERN.test(installation.push_token))
        .map((installation) => installation.id)
    const validInstallations = installations.filter((installation) => EXPO_PUSH_TOKEN_PATTERN.test(installation.push_token))

    if (malformedIds.length) {
        await mutateInstallations(db, malformedIds, {
            enabled: false,
            invalidated_at: now().toISOString(),
            last_error_code: 'InvalidExpoPushToken',
        })
    }


    // Snapshot the recipient devices before the first provider call. If the
    // worker crashes, lease recovery keeps the event bound to the same devices
    // instead of also notifying devices registered after the original message.
    if (row.target_installation_ids === null) {
        const targetIds = validInstallations.map((installation) => installation.id)
        const owned = await checkpointClaim(db, row, { target_installation_ids: targetIds })
        if (!owned) return 'skipped'
        row.target_installation_ids = targetIds
    }

    if (!validInstallations.length) {
        if (priorTickets.length) {
            const updated = await finishClaim(db, row, {
                status: 'receipt_pending',
                delivery_stage: 'receipt',
                target_installation_ids: [],
                next_attempt_at: receiptRetryAt(1, now),
                processed_at: null,
            })
            return updated ? 'receipt_pending' : 'skipped'
        }
        const updated = await finishClaim(db, row, {
            status: malformedIds.length ? 'failed' : 'sent',
            delivery_stage: 'send',
            target_installation_ids: [],
            processed_at: now().toISOString(),
            last_error: malformedIds.length ? 'InvalidExpoPushToken' : null,
        })
        if (!updated) return 'skipped'
        return malformedIds.length ? 'failed' : 'skipped'
    }

    const acceptedTickets: TicketMapEntry[] = []
    const retryInstallationIds: string[] = []
    const invalidInstallationIds: string[] = []
    let terminalTicketErrorCount = 0
    let lastError: string | null = null

    const content = await loadPushContent(db, row)
    const installationBatches = chunks(validInstallations, SEND_BATCH_SIZE)
    for (let batchIndex = 0; batchIndex < installationBatches.length; batchIndex += 1) {
        const batch = installationBatches[batchIndex]
        try {
            const response = await fetchImpl(EXPO_PUSH_ENDPOINT, {
                method: 'POST',
                headers: expoHeaders(expoAccessToken),
                body: JSON.stringify(batch.map((installation) => ({
                    to: installation.push_token,
                    sound: 'default',
                    priority: 'high',
                    title: content.title,
                    body: content.body,
                    data: safeNotificationData(row),
                    channelId: 'messages',
                }))),
                signal: AbortSignal.timeout(10_000),
            })
            const tickets = await parseExpoResponse<ExpoDeliveryResult[]>(response, 'array')
            if (tickets.length !== batch.length) {
                throw new Error('Expo Push returned a mismatched ticket count')
            }
            tickets.forEach((ticket, index) => {
                const installationId = batch[index].id
                if (ticket.status === 'ok' && typeof ticket.id === 'string' && ticket.id.trim()) {
                    acceptedTickets.push({ ticketId: ticket.id.trim(), installationId })
                    return
                }
                const errorCode = ticket.details?.error || 'ExpoTicketRejected'
                lastError ||= redactMobilePushError(ticket.message || errorCode)
                if (errorCode === 'DeviceNotRegistered') invalidInstallationIds.push(installationId)
                else if (isTerminalExpoError(errorCode)) terminalTicketErrorCount += 1
                else retryInstallationIds.push(installationId)
            })
        } catch (error) {
            lastError ||= redactMobilePushError(error)
            retryInstallationIds.push(...batch.map((installation) => installation.id))
        }

        const futureIds = installationBatches
            .slice(batchIndex + 1)
            .flatMap((futureBatch) => futureBatch.map((installation) => installation.id))
        const checkpointTargets = unique([...retryInstallationIds, ...futureIds])
        const checkpointTickets = appendTicketMap(priorTickets, acceptedTickets)
        const owned = await checkpointClaim(db, row, {
            target_installation_ids: checkpointTargets,
            expo_ticket_map: checkpointTickets,
            expo_ticket_id: checkpointTickets[0]?.ticketId || null,
            last_error: lastError,
        })
        if (!owned) return 'skipped'
        row.target_installation_ids = checkpointTargets
        row.expo_ticket_map = checkpointTickets
    }

    if (invalidInstallationIds.length) {
        await mutateInstallations(db, invalidInstallationIds, {
            enabled: false,
            invalidated_at: now().toISOString(),
            last_error_code: 'DeviceNotRegistered',
        })
    }

    const ticketMap = appendTicketMap(priorTickets, acceptedTickets)
    const retryIds = unique(retryInstallationIds)
    const exhausted = row.attempt_count >= MAX_SEND_ATTEMPTS

    if (retryIds.length && !exhausted) {
        const updated = await finishClaim(db, row, {
            status: 'retry',
            delivery_stage: 'send',
            target_installation_ids: retryIds,
            expo_ticket_map: ticketMap,
            expo_ticket_id: ticketMap[0]?.ticketId || null,
            next_attempt_at: retryAt(row.attempt_count, now),
            last_error: lastError,
            processed_at: null,
        })
        return updated ? 'retried' : 'skipped'
    }

    if (ticketMap.length) {
        const updated = await finishClaim(db, row, {
            status: 'receipt_pending',
            delivery_stage: 'receipt',
            target_installation_ids: [],
            expo_ticket_map: ticketMap,
            expo_ticket_id: ticketMap[0].ticketId,
            next_attempt_at: receiptRetryAt(1, now),
            last_error: retryIds.length || terminalTicketErrorCount || invalidInstallationIds.length
                ? (lastError || '部分设备未接受推送请求')
                : null,
            processed_at: null,
        })
        return updated ? 'receipt_pending' : 'skipped'
    }

    const updated = await finishClaim(db, row, {
        status: 'failed',
        delivery_stage: 'send',
        target_installation_ids: [],
        next_attempt_at: retryAt(row.attempt_count, now),
        last_error: lastError || (terminalTicketErrorCount ? 'Expo 拒绝了推送请求' : '没有设备接受推送请求'),
        processed_at: now().toISOString(),
    })
    return updated ? 'failed' : 'skipped'
}

async function processReceiptRow(row: OutboxRow, dependencies: ProcessorDependencies): Promise<RowResult> {
    const { db, fetchImpl, now, expoAccessToken } = dependencies
    const ticketMap = parseTicketMap(row.expo_ticket_map)
    if (!ticketMap.length) {
        const delivered = Number(row.delivered_count || 0)
        const updated = await finishClaim(db, row, {
            status: delivered > 0 ? 'sent' : 'failed',
            processed_at: now().toISOString(),
            last_error: delivered > 0 ? null : '缺少可核验的 Expo ticket',
        })
        if (!updated) return 'skipped'
        return delivered > 0 ? 'sent' : 'failed'
    }

    const receiptAttempt = Number(row.receipt_attempt_count || 0) + 1
    const pendingTickets: TicketMapEntry[] = []
    const resendInstallationIds: string[] = []
    const invalidInstallationIds: string[] = []
    let deliveredCount = Number(row.delivered_count || 0)
    let terminalErrorCount = 0
    let lastError: string | null = null

    for (const batch of chunks(ticketMap, RECEIPT_BATCH_SIZE)) {
        try {
            const response = await fetchImpl(EXPO_RECEIPTS_ENDPOINT, {
                method: 'POST',
                headers: expoHeaders(expoAccessToken),
                body: JSON.stringify({ ids: batch.map((entry) => entry.ticketId) }),
                signal: AbortSignal.timeout(10_000),
            })
            const receipts = await parseExpoResponse<Record<string, ExpoDeliveryResult>>(response, 'object')
            batch.forEach((entry) => {
                const receipt = receipts[entry.ticketId]
                if (!receipt || (receipt.status !== 'ok' && receipt.status !== 'error')) {
                    pendingTickets.push(entry)
                    return
                }
                if (receipt.status === 'ok') {
                    deliveredCount += 1
                    return
                }
                const errorCode = receipt.details?.error || 'ExpoReceiptRejected'
                lastError ||= redactMobilePushError(receipt.message || errorCode)
                if (errorCode === 'DeviceNotRegistered') {
                    invalidInstallationIds.push(entry.installationId)
                } else if (errorCode === 'MessageRateExceeded') {
                    resendInstallationIds.push(entry.installationId)
                } else {
                    terminalErrorCount += 1
                }
            })
        } catch (error) {
            lastError ||= redactMobilePushError(error)
            pendingTickets.push(...batch)
        }
    }

    if (invalidInstallationIds.length) {
        await mutateInstallations(db, invalidInstallationIds, {
            enabled: false,
            invalidated_at: now().toISOString(),
            last_error_code: 'DeviceNotRegistered',
        })
    }

    const resendIds = unique(resendInstallationIds)
    const remainingTickets = parseTicketMap(pendingTickets)
    if (resendIds.length && row.attempt_count < MAX_SEND_ATTEMPTS) {
        const updated = await finishClaim(db, row, {
            status: 'retry',
            delivery_stage: 'send',
            receipt_attempt_count: receiptAttempt,
            target_installation_ids: resendIds,
            expo_ticket_map: remainingTickets,
            delivered_count: deliveredCount,
            next_attempt_at: retryAt(Math.max(row.attempt_count, 1), now),
            last_error: lastError,
            processed_at: null,
        })
        return updated ? 'retried' : 'skipped'
    }

    if (remainingTickets.length && receiptAttempt < MAX_RECEIPT_ATTEMPTS) {
        const updated = await finishClaim(db, row, {
            status: 'receipt_pending',
            delivery_stage: 'receipt',
            receipt_attempt_count: receiptAttempt,
            target_installation_ids: [],
            expo_ticket_map: remainingTickets,
            delivered_count: deliveredCount,
            next_attempt_at: receiptRetryAt(receiptAttempt, now),
            last_error: lastError,
            processed_at: null,
        })
        return updated ? 'receipt_pending' : 'skipped'
    }

    const successful = deliveredCount > 0
    const terminalMessage = remainingTickets.length
        ? 'Expo receipt 查询重试次数已耗尽'
        : resendIds.length
            ? 'Expo receipt 要求重发但发送重试次数已耗尽'
            : terminalErrorCount || invalidInstallationIds.length
                ? (lastError || 'Expo receipt 返回终止错误')
                : null
    const updated = await finishClaim(db, row, {
        status: successful ? 'sent' : 'failed',
        delivery_stage: 'receipt',
        receipt_attempt_count: receiptAttempt,
        target_installation_ids: [],
        expo_ticket_map: [],
        delivered_count: deliveredCount,
        processed_at: now().toISOString(),
        last_error: terminalMessage,
    })
    if (!updated) return 'skipped'
    return successful ? 'sent' : 'failed'
}

export async function processMobileNotificationOutbox(
    limit = 50,
    overrides: Partial<ProcessorDependencies> = {},
) {
    const dependencies: ProcessorDependencies = {
        db: serviceRoleSupabase as any,
        fetchImpl: fetch,
        now: () => new Date(),
        expoAccessToken: process.env.EXPO_ACCESS_TOKEN?.trim() || '',
        ...overrides,
    }
    const { data, error } = await dependencies.db.rpc('claim_mobile_notification_outbox', {
        p_limit: clampLimit(limit),
        p_lease_seconds: CLAIM_LEASE_SECONDS,
    })
    if (error) throw new Error(`领取移动通知队列失败: ${error.message}`)

    const rows = (data || []) as OutboxRow[]
    const totals = {
        selected: rows.length,
        sent: 0,
        retried: 0,
        failed: 0,
        skipped: 0,
        receiptPending: 0,
    }

    for (const row of rows) {
        try {
            const result = row.delivery_stage === 'receipt'
                ? await processReceiptRow(row, dependencies)
                : await processSendRow(row, dependencies)
            if (result === 'sent') totals.sent += 1
            else if (result === 'retried') totals.retried += 1
            else if (result === 'failed') totals.failed += 1
            else if (result === 'receipt_pending') totals.receiptPending += 1
            else totals.skipped += 1
        } catch (rowError) {
            const result = row.delivery_stage === 'send'
                ? await scheduleSendFailure(row, rowError, dependencies)
                : await finishClaim(dependencies.db, row, {
                    status: row.receipt_attempt_count + 1 >= MAX_RECEIPT_ATTEMPTS ? 'failed' : 'receipt_pending',
                    delivery_stage: 'receipt',
                    receipt_attempt_count: row.receipt_attempt_count + 1,
                    next_attempt_at: receiptRetryAt(row.receipt_attempt_count + 1, dependencies.now),
                    last_error: redactMobilePushError(rowError),
                    processed_at: row.receipt_attempt_count + 1 >= MAX_RECEIPT_ATTEMPTS
                        ? dependencies.now().toISOString()
                        : null,
                }).then((updated) => {
                    if (!updated) return 'skipped' as const
                    return row.receipt_attempt_count + 1 >= MAX_RECEIPT_ATTEMPTS
                        ? 'failed' as const
                        : 'receipt_pending' as const
                })
            if (result === 'retried') totals.retried += 1
            else if (result === 'failed') totals.failed += 1
            else if (result === 'receipt_pending') totals.receiptPending += 1
            else totals.skipped += 1
        }
    }

    return totals
}
