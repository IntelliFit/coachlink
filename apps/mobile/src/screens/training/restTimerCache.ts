import AsyncStorage from '@react-native-async-storage/async-storage'

export const TRAINING_REST_TIMERS_KEY = 'training_rest_timers_v1'

type RestTimerEntry = {
  executionId: string
  deadlineAt: number
  savedAt: number
}

type RestTimerStore = {
  v: 1
  userId: string
  entries: Record<string, RestTimerEntry>
}

async function readStore(userId: string): Promise<RestTimerStore> {
  const empty: RestTimerStore = { v: 1, userId, entries: {} }
  if (!userId) return empty
  const raw = await AsyncStorage.getItem(TRAINING_REST_TIMERS_KEY)
  if (!raw) return empty
  try {
    const parsed = JSON.parse(raw) as RestTimerStore
    if (parsed?.v !== 1 || String(parsed.userId || '') !== String(userId)) return empty
    return { ...parsed, entries: parsed.entries || {} }
  } catch {
    await AsyncStorage.removeItem(TRAINING_REST_TIMERS_KEY)
    return empty
  }
}

async function writeStore(store: RestTimerStore) {
  await AsyncStorage.setItem(TRAINING_REST_TIMERS_KEY, JSON.stringify(store))
}

export async function readRestTimerDeadline(userId: string, executionId: string) {
  if (!userId || !executionId) return 0
  const store = await readStore(userId)
  const entry = store.entries[executionId]
  if (!entry) return 0
  if (!Number.isFinite(entry.deadlineAt) || entry.deadlineAt <= Date.now()) {
    delete store.entries[executionId]
    await writeStore(store)
    return 0
  }
  return entry.deadlineAt
}

export async function persistRestTimerDeadline(
  userId: string,
  executionId: string,
  deadlineAt: number,
) {
  if (!userId || !executionId || !Number.isFinite(deadlineAt)) return
  const store = await readStore(userId)
  store.entries[executionId] = { executionId, deadlineAt, savedAt: Date.now() }
  await writeStore(store)
}

export async function clearRestTimerDeadline(userId: string, executionId: string) {
  if (!userId || !executionId) return
  const store = await readStore(userId)
  if (!store.entries[executionId]) return
  delete store.entries[executionId]
  await writeStore(store)
}
