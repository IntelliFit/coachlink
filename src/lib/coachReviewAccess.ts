/**
 * 教练记录（coach_reviews）的读写归属。
 *
 * - 学员：只能读自己订阅上的记录（个人资料「教练评语」）。
 * - 教练：只能读、写自己名下订阅上的记录。
 * - 请求里的 coachId / studentId 只作为筛选条件，归属一律以登录身份和订阅表为准。
 */

type Db = any

export type ReviewAccessResult =
    | { ok: true; subscriptionIds: string[] }
    | { ok: false; status: 403 | 404 | 500; message: string }

export async function resolveCoachIdForUser(db: Db, userId: string): Promise<string | null> {
    const { data, error } = await db.from('coaches').select('id').eq('user_id', userId).maybeSingle()
    if (error) throw new Error(`读取教练信息失败: ${error.message}`)
    return data?.id ? String(data.id) : null
}

export async function resolveReadableReviewSubscriptionIds(
    db: Db,
    userId: string,
    filters: { subscriptionId?: string | null; studentId?: string | null },
): Promise<ReviewAccessResult> {
    const subscriptionId = String(filters.subscriptionId || '').trim()
    const studentId = String(filters.studentId || '').trim()
    const coachId = await resolveCoachIdForUser(db, userId)

    if (subscriptionId) {
        const { data: subscription, error } = await db
            .from('coach_subscriptions')
            .select('id, student_id, coach_id')
            .eq('id', subscriptionId)
            .maybeSingle()
        if (error) return { ok: false, status: 500, message: '获取订阅信息失败' }
        if (!subscription) return { ok: false, status: 404, message: '订阅不存在' }
        const isStudent = subscription.student_id === userId
        const isCoach = Boolean(coachId) && subscription.coach_id === coachId
        if (!isStudent && !isCoach) return { ok: false, status: 403, message: '无权查看该订阅的教练记录' }
        if (studentId && subscription.student_id !== studentId) return { ok: true, subscriptionIds: [] }
        return { ok: true, subscriptionIds: [String(subscription.id)] }
    }

    let query = db.from('coach_subscriptions').select('id')
    if (!studentId || studentId === userId) {
        // 学员看自己的；不带任何筛选时也只返回自己的，绝不返回全表。
        query = query.eq('student_id', userId)
    } else if (coachId) {
        query = query.eq('student_id', studentId).eq('coach_id', coachId)
    } else {
        return { ok: false, status: 403, message: '无权查看该学员的教练记录' }
    }
    const { data, error } = await query
    if (error) return { ok: false, status: 500, message: '获取订阅信息失败' }
    return { ok: true, subscriptionIds: (data || []).map((row: { id: string }) => String(row.id)) }
}

export type WritableSubscription = { id: string; student_id: string; coach_id: string }

/** 教练写记录前：订阅必须属于当前教练，写入的教练 / 学员 id 以订阅为准。 */
export async function resolveWritableReviewSubscription(
    db: Db,
    userId: string,
    subscriptionId: string | null | undefined,
): Promise<{ ok: true; subscription: WritableSubscription } | { ok: false; status: 400 | 403 | 404 | 500; message: string }> {
    const id = String(subscriptionId || '').trim()
    if (!id) return { ok: false, status: 400, message: '缺少订阅 ID' }
    const coachId = await resolveCoachIdForUser(db, userId)
    if (!coachId) return { ok: false, status: 403, message: '用户不是教练' }
    const { data: subscription, error } = await db
        .from('coach_subscriptions')
        .select('id, student_id, coach_id')
        .eq('id', id)
        .maybeSingle()
    if (error) return { ok: false, status: 500, message: '获取订阅信息失败' }
    if (!subscription) return { ok: false, status: 404, message: '订阅不存在' }
    if (subscription.coach_id !== coachId) return { ok: false, status: 403, message: '只能给自己的学员写记录' }
    return { ok: true, subscription: { id: String(subscription.id), student_id: String(subscription.student_id), coach_id: coachId } }
}
