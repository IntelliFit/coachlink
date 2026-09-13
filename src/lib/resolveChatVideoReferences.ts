import { serviceRoleSupabase } from '@/lib/supabaseClient'
import type { VideoReferenceItem } from '@/app/api/chat/send-message/entity'

const MAX_VIDEO_REFERENCES_PER_MESSAGE = 20
// These tables are introduced and queried across migrations that are newer than
// the generated Database type. Keeping the client boundary untyped here avoids
// pathological Supabase generic expansion while the function validates and
// canonicalizes every returned field before exposing it.
const supabase = serviceRoleSupabase as any

function findMatchingActionExecution(actionExecutions: unknown, actionId: string) {
    if (!Array.isArray(actionExecutions)) return null
    return actionExecutions.find((actionExecution: any) => (
        actionExecution?.id === actionId || actionExecution?.action_id === actionId
    )) ?? null
}

function findMatchingSetExecution(sets: unknown, setNumber: number) {
    if (!Array.isArray(sets)) return null
    return sets.find((setExecution: any, index: number) => (
        setExecution?.set_number === setNumber
        || setExecution?.setNumber === setNumber
        || index === Math.max(0, setNumber - 1)
    )) ?? null
}

function pickSetValue(setExecution: any, ...keys: string[]) {
    for (const key of keys) {
        const value = setExecution?.[key]
        if (value !== undefined && value !== null && value !== '') return value
    }
    return null
}

/**
 * Resolve canonical video metadata for a chat sender.
 * Client supplied URLs/titles/weights are intentionally ignored.
 */
export async function resolveAuthorizedChatVideoReferences(
    userId: string,
    rawVideoIds: string[],
): Promise<VideoReferenceItem[] | null> {
    const requestedIds = [...new Set(rawVideoIds.map((id) => String(id || '').trim()).filter(Boolean))]
    if (!requestedIds.length || requestedIds.length > MAX_VIDEO_REFERENCES_PER_MESSAGE) return null

    const allowedStudentIds = new Set<string>([userId])
    const { data: coach } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

    if (coach?.id) {
        const { data: subscriptions, error: subscriptionError } = await supabase
            .from('coach_subscriptions')
            .select('student_id')
            .eq('coach_id', coach.id)
            .eq('status', 'active')
        if (subscriptionError) {
            console.error('校验聊天视频教练关系失败:', subscriptionError)
            return null
        }
        for (const subscription of subscriptions || []) allowedStudentIds.add(subscription.student_id)
    }

    const executionIds = requestedIds.filter((id) => !id.startsWith('vc:'))
    const collectionIds = requestedIds.filter((id) => id.startsWith('vc:')).map((id) => id.slice(3))
    const [executionResult, collectionResult] = await Promise.all([
        executionIds.length
            ? supabase
                .from('execution_set_videos')
                .select(`
                    id,
                    action_id,
                    video_url,
                    thumbnail_url,
                    exercise_name,
                    set_number,
                    created_at,
                    plan_instance_executions!inner(student_id, action_executions, day_index)
                `)
                .in('id', executionIds)
            : Promise.resolve({ data: [], error: null }),
        collectionIds.length
            ? supabase
                .from('student_video_collections')
                .select('id, user_id, video_url, thumbnail_url, created_at, title, description, tags, source')
                .in('id', collectionIds)
                .is('deleted_at', null)
            : Promise.resolve({ data: [], error: null }),
    ])

    if (executionResult.error || collectionResult.error) {
        console.error('校验聊天视频引用失败:', executionResult.error || collectionResult.error)
        return null
    }

    const authorizedById = new Map<string, VideoReferenceItem>()
    const studentIds = new Set<string>()

    for (const video of executionResult.data || []) {
        const execution = (video as any).plan_instance_executions
        const studentId = execution?.student_id
        if (!studentId || !allowedStudentIds.has(studentId)) continue
        studentIds.add(studentId)

        let actionName = video.exercise_name || '未命名动作'
        let weight: number | null = null
        let reps: number | null = null
        const matchedAction = findMatchingActionExecution(execution.action_executions, video.action_id)
        if (matchedAction) {
            actionName = matchedAction.action_name || matchedAction.name || actionName
            const matchedSet = findMatchingSetExecution(matchedAction.sets, video.set_number || 1)
            if (matchedSet) {
                weight = pickSetValue(matchedSet, 'actual_weight', 'actualWeight', 'completed_weight', 'planned_weight', 'plannedWeight', 'weight')
                reps = pickSetValue(matchedSet, 'actual_reps', 'actualReps', 'completed_reps', 'planned_reps', 'plannedReps', 'reps')
            }
        }

        authorizedById.set(video.id, {
            videoId: video.id,
            videoUrl: video.video_url,
            thumbnailUrl: video.thumbnail_url,
            actionName,
            sourceType: 'execution_set',
            setNumber: video.set_number || 1,
            weight,
            reps,
            isProgress: false,
            createdAt: video.created_at,
            dayIndex: execution.day_index ?? null,
        })
    }

    for (const collection of collectionResult.data || []) {
        if (!collection.user_id || !allowedStudentIds.has(collection.user_id)) continue
        studentIds.add(collection.user_id)
        const description = (collection.description || '').trim()
        authorizedById.set(`vc:${collection.id}`, {
            videoId: `vc:${collection.id}`,
            videoUrl: collection.video_url,
            thumbnailUrl: collection.thumbnail_url,
            actionName: (collection.title || '').trim() || description || '个人上传视频',
            description: description || null,
            tags: Array.isArray(collection.tags) ? collection.tags : [],
            sourceType: 'video_collection',
            setNumber: 1,
            weight: null,
            reps: null,
            isProgress: collection.source === 'progress_set',
            createdAt: collection.created_at,
            dayIndex: null,
        })
    }

    if (requestedIds.some((id) => !authorizedById.has(id))) return null

    if (studentIds.size > 0) {
        const { data: profiles } = await supabase
            .from('user_profiles')
            .select('user_id, full_name, nickname, avatar_url')
            .in('user_id', [...studentIds])
        const profileByUserId = new Map<string, any>(
            (profiles || []).map((profile: any) => [profile.user_id, profile]),
        )
        for (const [id, reference] of authorizedById.entries()) {
            const ownerId = id.startsWith('vc:')
                ? (collectionResult.data || []).find((item) => `vc:${item.id}` === id)?.user_id
                : (executionResult.data || []).find((item) => item.id === id)?.plan_instance_executions?.student_id
            const profile = ownerId ? profileByUserId.get(ownerId) : null
            if (ownerId) {
                authorizedById.set(id, {
                    ...reference,
                    studentInfo: {
                        id: ownerId,
                        fullName: profile?.full_name || null,
                        nickname: profile?.nickname || null,
                        avatarUrl: profile?.avatar_url || null,
                    },
                })
            }
        }
    }

    return requestedIds.map((id) => authorizedById.get(id)!)
}
