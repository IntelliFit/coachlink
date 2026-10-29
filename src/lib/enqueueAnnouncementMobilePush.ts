import { serviceRoleSupabase } from '@/lib/supabaseClient'
import { isAnnouncementLive, matchesAudience, type AnnouncementRow } from '@/lib/announcements'

/**
 * 公告发布后给 APP 用户发系统推送。
 *
 * 只推「需要弹窗」的公告（后台勾选 popup，代表重要通知），普通公告只进通知列表和红点，
 * 避免每条运营公告都打扰用户。只给已开启推送的设备所属用户入队；dedupe_key 按
 * 公告 + 用户去重，下线后重新发布也不会重复推送同一个人。
 */

const PAGE_SIZE = 1000
const INSERT_BATCH_SIZE = 500

type Db = any

function chunks<T>(values: T[], size: number) {
    const result: T[][] = []
    for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size))
    return result
}

async function loadPushUserIds(db: Db): Promise<string[]> {
    const ids = new Set<string>()
    for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await db
            .from('mobile_push_installations')
            .select('user_id')
            .eq('provider', 'expo')
            .eq('enabled', true)
            .order('user_id', { ascending: true })
            .range(from, from + PAGE_SIZE - 1)
        if (error) throw new Error(`读取推送设备失败: ${error.message}`)
        const rows = (data || []) as Array<{ user_id?: string | null }>
        rows.forEach((row) => {
            if (typeof row.user_id === 'string' && row.user_id) ids.add(row.user_id)
        })
        if (rows.length < PAGE_SIZE) break
    }
    return [...ids]
}

async function filterByAudience(db: Db, userIds: string[], audience: AnnouncementRow['audience']): Promise<string[]> {
    if (audience === 'all' || userIds.length === 0) return userIds
    const matched: string[] = []
    for (const batch of chunks(userIds, INSERT_BATCH_SIZE)) {
        const { data, error } = await db.from('users').select('id, is_coach').in('id', batch)
        if (error) throw new Error(`读取用户身份失败: ${error.message}`)
        for (const row of (data || []) as Array<{ id: string; is_coach?: boolean | null }>) {
            if (matchesAudience(audience, row.is_coach === true)) matched.push(row.id)
        }
    }
    return matched
}

export async function enqueueAnnouncementMobilePush(
    announcement: AnnouncementRow,
    options: { db?: Db; now?: Date } = {},
): Promise<number> {
    const db = options.db || serviceRoleSupabase
    const now = options.now || new Date()
    if (!announcement.popup || !isAnnouncementLive(announcement, now)) return 0

    const recipients = await filterByAudience(db, await loadPushUserIds(db), announcement.audience)
    let queued = 0
    for (const batch of chunks(recipients, INSERT_BATCH_SIZE)) {
        const rows = batch.map((userId) => ({
            recipient_user_id: userId,
            kind: 'announcement',
            dedupe_key: `announcement:${announcement.id}:${userId}`,
            // 队列只存类型和 UUID（见 docs/ops/mobile-push.md），标题在发送时再查。
            payload: { kind: 'announcement', announcementId: announcement.id },
        }))
        const { error } = await db
            .from('mobile_notification_outbox')
            .upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
        if (error) throw new Error(`公告推送入队失败: ${error.message}`)
        queued += rows.length
    }
    return queued
}
