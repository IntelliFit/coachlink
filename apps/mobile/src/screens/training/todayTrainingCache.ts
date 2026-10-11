import AsyncStorage from '@react-native-async-storage/async-storage'
import { projectPlanCacheProgress } from '@coachlink/core/src/planCacheProgress'

export const TODAY_TRAINING_CACHE_KEY = 'today_training_page_cache_v1'
const RETENTION_MS = 60 * 24 * 60 * 60 * 1000

export type TodayTrainingPlanMode = 'coach' | 'self'

export type TodayTrainingPlanBlock = {
  instance: any | null
  actions: Record<string, any>
  recommendedDayIndex: number
  todayCompleted: boolean
  completionDates: Record<number, string>
  executionsByDayIndex: Record<number, any>
  missingDays: number[]
  completedDays?: number[]
  resolvedDays?: number[]
  totalTrainingDays?: number
  isLogicallyCompleted?: boolean
  entitlement?: any
}

/**
 * 与小程序今日训练页保持同一数据模型。缓存键继续使用 v1，避免一次升级产生两份
 * 互不相认的数据；read 时会把 App 早期的单计划 v1 结构迁移成当前结构。
 */
export type TodayTrainingCache = {
  v: 1
  userId: string
  savedAt: number
  coachSubscriptions: any[]
  coachPlanDataBySubId: Record<string, TodayTrainingPlanBlock>
  activeCoachSubscriptionId: string | null
  selfPlanData: TodayTrainingPlanBlock
  recentActions: any[]
  planMode: TodayTrainingPlanMode
  selectedDayIndex: number
}

export type TodayTrainingCachePayload = Omit<TodayTrainingCache, 'v' | 'savedAt'>

export function emptyTodayTrainingPlanBlock(): TodayTrainingPlanBlock {
  return {
    instance: null,
    actions: {},
    recommendedDayIndex: 1,
    todayCompleted: false,
    completionDates: {},
    executionsByDayIndex: {},
    missingDays: [],
  }
}

export function normalizeTodayTrainingPlanBlock(value: any): TodayTrainingPlanBlock {
  if (!value || typeof value !== 'object') return emptyTodayTrainingPlanBlock()
  return {
    ...value,
    instance: value.instance ?? null,
    actions: value.actions && typeof value.actions === 'object' ? value.actions : {},
    recommendedDayIndex:
      Number(value.recommendedDayIndex ?? value.nextDayIndex ?? value.dayIndex ?? 1) || 1,
    todayCompleted: Boolean(value.todayCompleted),
    completionDates:
      value.completionDates && typeof value.completionDates === 'object'
        ? value.completionDates
        : {},
    executionsByDayIndex:
      value.executionsByDayIndex && typeof value.executionsByDayIndex === 'object'
        ? value.executionsByDayIndex
        : {},
    missingDays: Array.isArray(value.missingDays)
      ? value.missingDays.map(Number).filter((day: number) => day > 0)
      : [],
  }
}

function normalizeCache(raw: any): TodayTrainingCache | null {
  if (!raw || raw.v !== 1) return null

  if (raw.selfPlanData || raw.coachPlanDataBySubId || raw.coachSubscriptions) {
    const coachPlans = Object.fromEntries(
      Object.entries(raw.coachPlanDataBySubId || {}).map(([key, value]) => [
        key,
        normalizeTodayTrainingPlanBlock(value),
      ]),
    )
    return {
      v: 1,
      userId: String(raw.userId || ''),
      savedAt: Number(raw.savedAt || 0),
      coachSubscriptions: Array.isArray(raw.coachSubscriptions) ? raw.coachSubscriptions : [],
      coachPlanDataBySubId: coachPlans,
      activeCoachSubscriptionId: raw.activeCoachSubscriptionId
        ? String(raw.activeCoachSubscriptionId)
        : null,
      selfPlanData: normalizeTodayTrainingPlanBlock(raw.selfPlanData),
      recentActions: Array.isArray(raw.recentActions) ? raw.recentActions : [],
      planMode: raw.planMode === 'self' ? 'self' : 'coach',
      selectedDayIndex: Number(raw.selectedDayIndex || 1) || 1,
    }
  }

  // 兼容 App 早期只保存 todayPlan/activeInstanceId 的缓存。
  const legacyPlan = raw.todayPlan
  const instance = legacyPlan?.instance || legacyPlan || null
  const block = normalizeTodayTrainingPlanBlock({
    ...(legacyPlan || {}),
    instance,
    actions: Object.fromEntries(
      (Array.isArray(raw.actions) ? raw.actions : [])
        .filter((item: any) => item?.id)
        .map((item: any) => [String(item.id), item]),
    ),
    executionsByDayIndex: raw.executionsByDayIndex || {},
  })
  const isSelf = String(instance?.source || '').toLowerCase() === 'self'
  const subscriptionId = String(instance?.coach_subscription_id || '')
  return {
    v: 1,
    userId: String(raw.userId || ''),
    savedAt: Number(raw.savedAt || 0),
    coachSubscriptions: [],
    coachPlanDataBySubId: !isSelf && subscriptionId ? { [subscriptionId]: block } : {},
    activeCoachSubscriptionId: !isSelf && subscriptionId ? subscriptionId : null,
    selfPlanData: isSelf ? block : emptyTodayTrainingPlanBlock(),
    recentActions: Array.isArray(raw.actions) ? raw.actions : [],
    planMode: isSelf ? 'self' : 'coach',
    selectedDayIndex: block.recommendedDayIndex,
  }
}

function isFresh(cache: TodayTrainingCache) {
  return Number.isFinite(cache.savedAt) && Date.now() - cache.savedAt <= RETENTION_MS
}

export async function readTodayTrainingCache(userId: string): Promise<TodayTrainingCache | null> {
  if (!userId) return null
  const raw = await AsyncStorage.getItem(TODAY_TRAINING_CACHE_KEY)
  if (!raw) return null

  try {
    const cache = normalizeCache(JSON.parse(raw))
    if (!cache || String(cache.userId || '') !== String(userId)) return null
    if (!isFresh(cache)) {
      await AsyncStorage.removeItem(TODAY_TRAINING_CACHE_KEY)
      return null
    }
    return cache
  } catch {
    await AsyncStorage.removeItem(TODAY_TRAINING_CACHE_KEY)
    return null
  }
}

export async function persistTodayTrainingCache(cache: TodayTrainingCachePayload) {
  await AsyncStorage.setItem(
    TODAY_TRAINING_CACHE_KEY,
    JSON.stringify({ v: 1, savedAt: Date.now(), ...cache } satisfies TodayTrainingCache),
  )
}

export function getActiveTodayTrainingPlan(cache: TodayTrainingCache | null) {
  if (!cache) return emptyTodayTrainingPlanBlock()
  if (cache.planMode === 'self') return cache.selfPlanData
  if (cache.activeCoachSubscriptionId) {
    return (
      cache.coachPlanDataBySubId[cache.activeCoachSubscriptionId] ||
      emptyTodayTrainingPlanBlock()
    )
  }
  return emptyTodayTrainingPlanBlock()
}

export async function patchTodayTrainingCacheSelection(
  userId: string,
  partial: Pick<TodayTrainingCache, 'planMode'> &
    Partial<Pick<TodayTrainingCache, 'activeCoachSubscriptionId' | 'selectedDayIndex'>>,
) {
  const current = await readTodayTrainingCache(userId)
  if (!current) return
  await persistTodayTrainingCache({
    ...current,
    ...partial,
    userId,
  })
}

export async function patchExecutionInTodayTrainingCache(
  userId: string,
  instanceId: string,
  dayIndex: number,
  execution: unknown,
) {
  if (!userId || !instanceId || !Number.isFinite(dayIndex) || dayIndex <= 0 || !execution) return
  if ((execution as any).status === 'preview' || String((execution as any).id || '').startsWith('preview-')) return
  const current = await readTodayTrainingCache(userId)
  if (!current) return

  if (String(current.selfPlanData.instance?.id || '') === String(instanceId)) {
    await persistTodayTrainingCache({
      ...current,
      userId,
      selfPlanData: projectPlanCacheProgress({
        ...current.selfPlanData,
        executionsByDayIndex: {
          ...current.selfPlanData.executionsByDayIndex,
          [dayIndex]: execution,
        },
      }),
    })
    return
  }

  const entry = Object.entries(current.coachPlanDataBySubId).find(
    ([, block]) => String(block.instance?.id || '') === String(instanceId),
  )
  if (!entry) return
  const [subscriptionId, block] = entry
  await persistTodayTrainingCache({
    ...current,
    userId,
    coachPlanDataBySubId: {
      ...current.coachPlanDataBySubId,
      [subscriptionId]: projectPlanCacheProgress({
        ...block,
        executionsByDayIndex: { ...block.executionsByDayIndex, [dayIndex]: execution },
      }),
    },
  })
}
