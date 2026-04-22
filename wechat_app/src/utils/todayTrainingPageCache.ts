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

export function readTodayTrainingPageCache(userId: string): TodayTrainingPageCacheV1 | null {
  if (!userId) return null
  try {
    const raw = Taro.getStorageSync(TODAY_TRAINING_PAGE_CACHE_KEY) as any
    if (!raw || typeof raw !== 'object') return null
    if (raw.v !== 1) return null
    if (String(raw.userId || '') !== String(userId)) return null
    const savedAt = Number(raw.savedAt || 0)
    if (!savedAt || Date.now() - savedAt > TODAY_TRAINING_CACHE_MAX_AGE_MS) return null
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

export function getTodayTrainingBootFromCache() {
  const session = authService.getAuthSession({ normalize: true })
  const userId = session.userId ? String(session.userId) : ''
  const cache = userId ? readTodayTrainingPageCache(userId) : null
  return { cache, userId }
}
