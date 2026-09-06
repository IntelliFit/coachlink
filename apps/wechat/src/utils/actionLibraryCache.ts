import Taro from '@tarojs/taro'

const ACTION_LIBRARY_FREQUENT_CACHE_KEY = 'action_library_frequent_cache_v1'
const ACTION_LIBRARY_CACHE_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000

type FrequentActionCache = {
  v: 1
  userId: string
  savedAt: number
  actions: any[]
}

export function readFrequentActionCache(userId: string): any[] | null {
  if (!userId) return null
  try {
    const raw = Taro.getStorageSync(ACTION_LIBRARY_FREQUENT_CACHE_KEY) as FrequentActionCache
    if (!raw || raw.v !== 1 || String(raw.userId || '') !== String(userId)) return null
    if (!raw.savedAt || Date.now() - raw.savedAt > ACTION_LIBRARY_CACHE_MAX_AGE_MS) return null
    return Array.isArray(raw.actions) ? raw.actions : []
  } catch {
    return null
  }
}

export function persistFrequentActionCache(userId: string, actions: any[]) {
  if (!userId) return
  try {
    Taro.setStorageSync(ACTION_LIBRARY_FREQUENT_CACHE_KEY, {
      v: 1,
      userId,
      savedAt: Date.now(),
      actions: Array.isArray(actions) ? actions : []
    } as FrequentActionCache)
  } catch (error) {
    console.warn('[action-library] persist frequent actions failed', error)
  }
}
