import Taro from '@tarojs/taro'
import type { ExerciseType } from '@/utils/streetliftingCalc'
import type { StreetliftingCalcHistoryRes, StreetliftingCalcSummary } from '@/services/streetliftingIndexService'
import { authService } from '@/services/authService'

const CACHE_KEY = 'streetlifting_calc_history_v1'
const CACHE_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000

type CacheEntry = {
  savedAt: number
  payload: StreetliftingCalcHistoryRes
}

type SummaryEntry = {
  savedAt: number
  payload: StreetliftingCalcSummary
}

type HistoryCacheStoreV1 = {
  v: 1
  userId: string
  histories: Record<string, CacheEntry>
  summaries: Record<string, SummaryEntry>
}

function buildHistoryKey(exerciseType?: ExerciseType | null) {
  return exerciseType || 'all'
}

function buildSummaryKey(exerciseType: ExerciseType) {
  return exerciseType
}

function getUserId() {
  const session = authService.getAuthSession({ normalize: true })
  return session.userId ? String(session.userId) : ''
}

function readStore(userId: string): HistoryCacheStoreV1 | null {
  if (!userId) return null
  try {
    const raw = Taro.getStorageSync(CACHE_KEY) as any
    if (!raw || typeof raw !== 'object' || raw.v !== 1) return null
    if (String(raw.userId || '') !== String(userId)) return null
    return raw as HistoryCacheStoreV1
  } catch {
    return null
  }
}

function prune<T extends { savedAt: number }>(entries: Record<string, T>) {
  const now = Date.now()
  const next: Record<string, T> = {}
  for (const key of Object.keys(entries || {})) {
    const entry = entries[key]
    const savedAt = Number(entry?.savedAt || 0)
    if (savedAt && now - savedAt <= CACHE_MAX_AGE_MS) {
      next[key] = entry
    }
  }
  return next
}

function writeStore(userId: string, store: HistoryCacheStoreV1) {
  try {
    Taro.setStorageSync(CACHE_KEY, {
      ...store,
      userId,
      histories: prune(store.histories || {}),
      summaries: prune(store.summaries || {})
    } satisfies HistoryCacheStoreV1)
  } catch (e) {
    console.warn('[streetlifting-calc] persist history cache failed', e)
  }
}

export function readStreetliftingCalcHistoryCache(exerciseType?: ExerciseType | null) {
  const userId = getUserId()
  const store = readStore(userId)
  const entry = store?.histories?.[buildHistoryKey(exerciseType)]
  if (!entry) return null
  if (Date.now() - Number(entry.savedAt || 0) > CACHE_MAX_AGE_MS) return null
  return entry.payload
}

export function persistStreetliftingCalcHistoryCache(
  payload: StreetliftingCalcHistoryRes,
  exerciseType?: ExerciseType | null
) {
  const userId = getUserId()
  if (!userId) return
  const store = readStore(userId) || { v: 1 as const, userId, histories: {}, summaries: {} }
  const nextStore: HistoryCacheStoreV1 = {
    ...store,
    userId,
    histories: {
      ...(store.histories || {}),
      [buildHistoryKey(exerciseType)]: {
        savedAt: Date.now(),
        payload
      }
    },
    summaries: { ...(store.summaries || {}) }
  }
  if (payload.summary?.latestRecord?.exerciseType) {
    nextStore.summaries[buildSummaryKey(payload.summary.latestRecord.exerciseType)] = {
      savedAt: Date.now(),
      payload: payload.summary
    }
  }
  writeStore(userId, nextStore)
}

export function readStreetliftingCalcSummaryCache(exerciseType: ExerciseType) {
  const userId = getUserId()
  const store = readStore(userId)
  const entry = store?.summaries?.[buildSummaryKey(exerciseType)]
  if (!entry) return null
  if (Date.now() - Number(entry.savedAt || 0) > CACHE_MAX_AGE_MS) return null
  return entry.payload
}

export function persistStreetliftingCalcSummaryCache(exerciseType: ExerciseType, summary: StreetliftingCalcSummary) {
  const userId = getUserId()
  if (!userId) return
  const store = readStore(userId) || { v: 1 as const, userId, histories: {}, summaries: {} }
  writeStore(userId, {
    ...store,
    userId,
    histories: { ...(store.histories || {}) },
    summaries: {
      ...(store.summaries || {}),
      [buildSummaryKey(exerciseType)]: {
        savedAt: Date.now(),
        payload: summary
      }
    }
  })
}
