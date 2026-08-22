import Taro from '@tarojs/taro'
import type {
  MotionGameKey,
  MotionGameRankingResult
} from '@/services/motionGameLeaderboardService'

const MOTION_GAME_RUNS_KEY = 'motion_game_runs_v1'
const MAX_RUN_AGE_MS = 60 * 24 * 60 * 60 * 1000
const MAX_RUNS = 50

export type CachedMotionGameRun = {
  id: string
  sessionId: string | null
  gameKey: MotionGameKey
  score: number
  elapsedMs: number
  actionCount: number
  lockRatio: number
  finishedAt: number
  syncStatus: 'pending' | 'synced' | 'local-only'
  ranking: MotionGameRankingResult | null
}

type MotionGameRunStore = {
  v: 1
  userId: string
  runs: CachedMotionGameRun[]
}

function readStore(userId: string): MotionGameRunStore {
  if (!userId) return { v: 1, userId: '', runs: [] }
  try {
    const raw = Taro.getStorageSync(MOTION_GAME_RUNS_KEY) as MotionGameRunStore
    if (!raw || raw.v !== 1 || String(raw.userId || '') !== String(userId)) {
      return { v: 1, userId, runs: [] }
    }
    const cutoff = Date.now() - MAX_RUN_AGE_MS
    return {
      v: 1,
      userId,
      runs: (raw.runs || [])
        .filter((run) => Number(run.finishedAt) >= cutoff)
        .sort((a, b) => b.finishedAt - a.finishedAt)
        .slice(0, MAX_RUNS)
    }
  } catch {
    return { v: 1, userId, runs: [] }
  }
}

function writeStore(store: MotionGameRunStore) {
  if (!store.userId) return
  try {
    Taro.setStorageSync(MOTION_GAME_RUNS_KEY, {
      ...store,
      runs: store.runs
        .sort((a, b) => b.finishedAt - a.finishedAt)
        .slice(0, MAX_RUNS)
    })
  } catch (error) {
    console.warn('[motion-game] persist local result failed:', error)
  }
}

export function persistMotionGameRunLocally(
  userId: string,
  payload: Omit<CachedMotionGameRun, 'id' | 'ranking' | 'syncStatus'>
) {
  const store = readStore(userId)
  const id = `${payload.gameKey}:${payload.finishedAt}:${Math.random().toString(36).slice(2, 8)}`
  const run: CachedMotionGameRun = {
    ...payload,
    id,
    ranking: null,
    syncStatus: payload.sessionId ? 'pending' : 'local-only'
  }
  writeStore({ ...store, runs: [run, ...store.runs] })
  return id
}

export function applyCloudMotionGameResult(
  userId: string,
  localRunId: string,
  ranking: MotionGameRankingResult
) {
  const store = readStore(userId)
  writeStore({
    ...store,
    runs: store.runs.map((run) => run.id === localRunId
      ? { ...run, ranking, syncStatus: 'synced' }
      : run)
  })
}

export function markMotionGameRunLocalOnly(userId: string, localRunId: string) {
  const store = readStore(userId)
  writeStore({
    ...store,
    runs: store.runs.map((run) => run.id === localRunId
      ? { ...run, syncStatus: 'local-only' }
      : run)
  })
}
