import AsyncStorage from '@react-native-async-storage/async-storage'

const TODAY_TRAINING_CACHE_KEY = 'today_training_page_cache_v1'
const RETENTION_MS = 60 * 24 * 60 * 60 * 1000

export type TodayTrainingCache = {
  v: 1
  userId: string
  savedAt: number
  activeInstanceId: string | null
  todayPlan: unknown
  actions: unknown[]
  executionsByDayIndex: Record<number, unknown>
}

function isFresh(cache: TodayTrainingCache) {
  return Number.isFinite(cache.savedAt) && Date.now() - cache.savedAt <= RETENTION_MS
}

export async function readTodayTrainingCache(userId: string): Promise<TodayTrainingCache | null> {
  if (!userId) return null
  const raw = await AsyncStorage.getItem(TODAY_TRAINING_CACHE_KEY)
  if (!raw) return null

  try {
    const cache = JSON.parse(raw) as TodayTrainingCache
    if (cache?.v !== 1 || String(cache.userId || '') !== String(userId)) return null
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

export async function persistTodayTrainingCache(cache: Omit<TodayTrainingCache, 'v' | 'savedAt'>) {
  await AsyncStorage.setItem(
    TODAY_TRAINING_CACHE_KEY,
    JSON.stringify({ v: 1, savedAt: Date.now(), ...cache } satisfies TodayTrainingCache),
  )
}

export async function patchExecutionInTodayTrainingCache(
  userId: string,
  instanceId: string,
  dayIndex: number,
  execution: unknown,
) {
  if (!userId || !instanceId || !Number.isFinite(dayIndex) || dayIndex <= 0 || !execution) return
  const current = await readTodayTrainingCache(userId)
  if (!current || current.activeInstanceId !== instanceId) return
  await persistTodayTrainingCache({
    userId,
    activeInstanceId: current.activeInstanceId,
    todayPlan: current.todayPlan,
    actions: current.actions,
    executionsByDayIndex: { ...current.executionsByDayIndex, [dayIndex]: execution },
  })
}
