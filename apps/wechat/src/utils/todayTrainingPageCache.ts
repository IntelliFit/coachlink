import Taro from '@tarojs/taro'
import type { PlanInstance } from '@/services/trainingService'
import { authService } from '@/services/authService'

/** 今日训练页展示数据：本地优先（与学员端 60 天缓存策略一致） */
export const TODAY_TRAINING_PAGE_CACHE_KEY = 'today_training_page_cache_v1'
export const TODAY_TRAINING_CACHE_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000

export type TodayTrainingPageCacheV1 = {
  v: 1
  userId: string
  savedAt: number
  coachSubscriptions: any[]
  coachPlanDataBySubId: Record<string, any>
  activeCoachSubscriptionId: string | null
  selfInstance: PlanInstance | null
  selfActions: Record<string, any>
  selfDayIndex: number
  selfTodayCompleted: boolean
  selfCompletionDates: Record<number, string>
  selfExecutionsByDayIndex: Record<number, any>
  selfMissingDays: number[]
  planMode: 'coach' | 'self'
  selectedDayIndex: number
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isRenderablePlan(value: unknown): boolean {
  if (value == null) return true
  if (!isRecord(value)) return false
  if (value.training_days == null) return true
  return Array.isArray(value.training_days) && value.training_days.every((day: unknown) =>
    isRecord(day) && (day.actionSets == null || (
      Array.isArray(day.actionSets) && day.actionSets.every(isRecord)
    ))
  )
}

function isRenderablePlanBlock(value: unknown): boolean {
  if (!isRecord(value) || !isRenderablePlan(value.instance)) return false
  for (const key of ['actions', 'completionDates', 'executionsByDayIndex']) {
    if (value[key] != null && !isRecord(value[key])) return false
  }
  return value.missingDays == null || Array.isArray(value.missingDays)
}

/** Storage is untyped at runtime; reject unsafe snapshots before React's first render. */
function isRenderablePageCache(value: Record<string, any>): boolean {
  if (value.coachSubscriptions != null && (
    !Array.isArray(value.coachSubscriptions) || !value.coachSubscriptions.every(isRecord)
  )) return false
  if (!isRenderablePlan(value.selfInstance)) return false
  if (value.selfMissingDays != null && !Array.isArray(value.selfMissingDays)) return false
  for (const key of ['coachPlanDataBySubId', 'selfActions', 'selfCompletionDates', 'selfExecutionsByDayIndex']) {
    if (value[key] != null && !isRecord(value[key])) return false
  }
  return Object.values(value.coachPlanDataBySubId || {}).every(isRenderablePlanBlock)
}

export function readTodayTrainingPageCache(userId: string): TodayTrainingPageCacheV1 | null {
  if (!userId) return null
  try {
    const raw = Taro.getStorageSync(TODAY_TRAINING_PAGE_CACHE_KEY) as any
    if (!isRecord(raw)) return null
    if (raw.v !== 1) return null
    if (String(raw.userId || '') !== String(userId)) return null
    const savedAt = Number(raw.savedAt || 0)
    if (!Number.isFinite(savedAt) || !savedAt || Date.now() - savedAt > TODAY_TRAINING_CACHE_MAX_AGE_MS) return null
    if (!isRenderablePageCache(raw)) return null
    return raw as TodayTrainingPageCacheV1
  } catch {
    return null
  }
}

export function persistTodayTrainingPageCache(payload: Omit<TodayTrainingPageCacheV1, 'v' | 'savedAt'>) {
  try {
    const toSave: TodayTrainingPageCacheV1 = {
      v: 1,
      savedAt: Date.now(),
      ...payload
    }
    Taro.setStorageSync(TODAY_TRAINING_PAGE_CACHE_KEY, toSave)
  } catch (e) {
    console.warn('[today-training] persist page cache failed', e)
  }
}

/** 合并首页缓存中的部分字段（需已有有效缓存） */
export function patchTodayTrainingPageCache(
  partial: Partial<Omit<TodayTrainingPageCacheV1, 'v' | 'savedAt' | 'userId'>>
) {
  const session = authService.getAuthSession({ normalize: true })
  const uid = session.userId ? String(session.userId) : ''
  if (!uid) return
  const cur = readTodayTrainingPageCache(uid)
  if (!cur) return
  const { v: _v, savedAt: _sa, ...rest } = cur
  persistTodayTrainingPageCache({ ...rest, userId: uid, ...partial })
}

/** 训练执行页回写当日 execution，用于首页进度条立即反映组完成情况 */
export function patchExecutionInTodayTrainingPageCache(
  userId: string,
  instanceId: string,
  dayIndex: number,
  execution: any
) {
  if (!userId || !instanceId || !execution) return
  const di = Number(dayIndex)
  if (!Number.isFinite(di) || di <= 0) return

  const cur = readTodayTrainingPageCache(userId)
  if (!cur) return

  const ex = execution && typeof execution === 'object' ? { ...execution } : execution

  if (cur.selfInstance?.id === instanceId) {
    persistTodayTrainingPageCache({
      userId,
      coachSubscriptions: cur.coachSubscriptions,
      coachPlanDataBySubId: cur.coachPlanDataBySubId,
      activeCoachSubscriptionId: cur.activeCoachSubscriptionId,
      selfInstance: cur.selfInstance,
      selfActions: cur.selfActions,
      selfDayIndex: cur.selfDayIndex,
      selfTodayCompleted: cur.selfTodayCompleted,
      selfCompletionDates: cur.selfCompletionDates,
      selfExecutionsByDayIndex: { ...(cur.selfExecutionsByDayIndex || {}), [di]: ex },
      selfMissingDays: cur.selfMissingDays,
      planMode: cur.planMode,
      selectedDayIndex: cur.selectedDayIndex
    })
    return
  }

  const coachPlanDataBySubId = { ...(cur.coachPlanDataBySubId || {}) }
  let hit = false
  for (const subId of Object.keys(coachPlanDataBySubId)) {
    const block = coachPlanDataBySubId[subId]
    if (block?.instance?.id === instanceId) {
      coachPlanDataBySubId[subId] = {
        ...block,
        executionsByDayIndex: { ...(block.executionsByDayIndex || {}), [di]: ex }
      }
      hit = true
      break
    }
  }

  if (!hit) return

  persistTodayTrainingPageCache({
    userId,
    coachSubscriptions: cur.coachSubscriptions,
    coachPlanDataBySubId,
    activeCoachSubscriptionId: cur.activeCoachSubscriptionId,
    selfInstance: cur.selfInstance,
    selfActions: cur.selfActions,
    selfDayIndex: cur.selfDayIndex,
    selfTodayCompleted: cur.selfTodayCompleted,
    selfCompletionDates: cur.selfCompletionDates,
    selfExecutionsByDayIndex: cur.selfExecutionsByDayIndex,
    selfMissingDays: cur.selfMissingDays,
    planMode: cur.planMode,
    selectedDayIndex: cur.selectedDayIndex
  })
}

/** 取消空训练后移除首页缓存中的 execution，使该训练日立即恢复未开始。 */
export function removeExecutionFromTodayTrainingPageCache(
  userId: string,
  instanceId: string,
  dayIndex: number
) {
  if (!userId || !instanceId) return
  const di = Number(dayIndex)
  if (!Number.isFinite(di) || di <= 0) return

  const cur = readTodayTrainingPageCache(userId)
  if (!cur) return

  if (cur.selfInstance?.id === instanceId) {
    const selfExecutionsByDayIndex = { ...(cur.selfExecutionsByDayIndex || {}) }
    delete selfExecutionsByDayIndex[di]
    persistTodayTrainingPageCache({
      userId,
      coachSubscriptions: cur.coachSubscriptions,
      coachPlanDataBySubId: cur.coachPlanDataBySubId,
      activeCoachSubscriptionId: cur.activeCoachSubscriptionId,
      selfInstance: cur.selfInstance,
      selfActions: cur.selfActions,
      selfDayIndex: cur.selfDayIndex,
      selfTodayCompleted: cur.selfTodayCompleted,
      selfCompletionDates: cur.selfCompletionDates,
      selfExecutionsByDayIndex,
      selfMissingDays: cur.selfMissingDays,
      planMode: cur.planMode,
      selectedDayIndex: cur.selectedDayIndex
    })
    return
  }

  const coachPlanDataBySubId = { ...(cur.coachPlanDataBySubId || {}) }
  let hit = false
  for (const subId of Object.keys(coachPlanDataBySubId)) {
    const block = coachPlanDataBySubId[subId]
    if (block?.instance?.id !== instanceId) continue
    const executionsByDayIndex = { ...(block.executionsByDayIndex || {}) }
    delete executionsByDayIndex[di]
    coachPlanDataBySubId[subId] = { ...block, executionsByDayIndex }
    hit = true
    break
  }
  if (!hit) return

  persistTodayTrainingPageCache({
    userId,
    coachSubscriptions: cur.coachSubscriptions,
    coachPlanDataBySubId,
    activeCoachSubscriptionId: cur.activeCoachSubscriptionId,
    selfInstance: cur.selfInstance,
    selfActions: cur.selfActions,
    selfDayIndex: cur.selfDayIndex,
    selfTodayCompleted: cur.selfTodayCompleted,
    selfCompletionDates: cur.selfCompletionDates,
    selfExecutionsByDayIndex: cur.selfExecutionsByDayIndex,
    selfMissingDays: cur.selfMissingDays,
    planMode: cur.planMode,
    selectedDayIndex: cur.selectedDayIndex
  })
}

export function getTodayTrainingBootFromCache() {
  const session = authService.getAuthSession({ normalize: true })
  const userId = session.userId ? String(session.userId) : ''
  const cache = userId ? readTodayTrainingPageCache(userId) : null
  return { cache, userId }
}
