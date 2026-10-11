import Taro from '@tarojs/taro'
import {
  patchExecutionInTodayTrainingPageCache,
  removeExecutionFromTodayTrainingPageCache
} from '@/utils/todayTrainingPageCache'

export const SNAPSHOT_KEY = 'training_execution_snapshots_v1'
/** 与今日训练首页缓存一致：仅保留最近 60 天内的快照条目 */
const SNAPSHOT_MAX_ENTRY_AGE_MS = 60 * 24 * 60 * 60 * 1000

type SnapshotEntry = {
  savedAt: number
  execution: any
  planInstance?: any
  actions?: Record<string, any>
}

type SnapshotStoreV1 = {
  v: 1
  userId: string
  entries: Record<string, SnapshotEntry>
}

function isPreviewExecution(execution: any): boolean {
  const status = String(execution?.status || '').toLowerCase()
  const id = String(execution?.id || '')
  return status === 'preview' || id.startsWith('preview-')
}

function readStore(userId: string): SnapshotStoreV1 | null {
  if (!userId) return null
  try {
    const raw = Taro.getStorageSync(SNAPSHOT_KEY) as any
    if (!raw || typeof raw !== 'object' || raw.v !== 1) return null
    if (String(raw.userId || '') !== String(userId)) return null
    return raw as SnapshotStoreV1
  } catch {
    return null
  }
}

function pruneEntries(entries: Record<string, SnapshotEntry>): Record<string, SnapshotEntry> {
  const now = Date.now()
  const next: Record<string, SnapshotEntry> = {}
  for (const key of Object.keys(entries || {})) {
    const ent = entries[key]
    const t = Number(ent?.savedAt || 0)
    if (t && now - t <= SNAPSHOT_MAX_ENTRY_AGE_MS) {
      next[key] = ent
    }
  }
  return next
}

function writeStore(userId: string, entries: Record<string, SnapshotEntry>) {
  try {
    Taro.setStorageSync(SNAPSHOT_KEY, {
      v: 1,
      userId,
      entries: pruneEntries(entries)
    } as SnapshotStoreV1)
  } catch (e) {
    console.warn('[training-execution] persist snapshot store failed', e)
  }
}

export function trainingExecutionSnapshotKey(params: {
  isImpromptuMode: boolean
  impromptuId?: string
  instanceId?: string
  dayIndex: number
}) {
  if (params.isImpromptuMode && params.impromptuId) {
    return `impromptu:${params.impromptuId}`
  }
  if (params.instanceId) {
    return `plan:${params.instanceId}:${params.dayIndex}`
  }
  return ''
}

export function readTrainingExecutionSnapshot(userId: string, scopeKey: string): SnapshotEntry | null {
  if (!userId || !scopeKey) return null
  const store = readStore(userId)
  const ent = store?.entries?.[scopeKey]
  if (!ent?.execution) return null
  const t = Number(ent.savedAt || 0)
  if (!t || Date.now() - t > SNAPSHOT_MAX_ENTRY_AGE_MS) return null
  return ent
}

/** 找到最近一次仍在进行中的即兴训练，用于从入口快速恢复。 */
export function findLatestInProgressImpromptuSnapshot(
  userId: string
): (SnapshotEntry & { scopeKey: string }) | null {
  const store = readStore(userId)
  if (!store) return null

  let latest: (SnapshotEntry & { scopeKey: string }) | null = null
  for (const [scopeKey, entry] of Object.entries(pruneEntries(store.entries || {}))) {
    if (!scopeKey.startsWith('impromptu:')) continue
    if (String(entry?.execution?.status || '').toLowerCase() !== 'in_progress') continue
    if (!entry.execution?.id) continue
    if (!latest || entry.savedAt > latest.savedAt) {
      latest = { ...entry, scopeKey }
    }
  }
  return latest
}

export function persistTrainingExecutionSnapshot(
  userId: string,
  scopeKey: string,
  payload: { execution: any; planInstance?: any; actions?: Record<string, any> },
  options?: { authoritative?: boolean }
) {
  if (!userId || !scopeKey || !payload?.execution) return
  const store = readStore(userId)
  const prev = store?.userId === userId ? store.entries || {} : {}
  const previousEntry = prev[scopeKey]
  const previousExecution = previousEntry?.execution
  const shouldKeepExistingExecution =
    !options?.authoritative &&
    isPreviewExecution(payload.execution) &&
    previousExecution &&
    !isPreviewExecution(previousExecution)

  const nextEntries = {
    ...prev,
    [scopeKey]: {
      savedAt: Date.now(),
      execution: shouldKeepExistingExecution ? previousExecution : payload.execution,
      planInstance: payload.planInstance ?? previousEntry?.planInstance,
      actions: payload.actions ?? previousEntry?.actions
    }
  }
  writeStore(userId, nextEntries)
}

/** 写入训练快照，并在计划模式下同步首页缓存中的 execution（供进度条使用） */
export function syncTrainingExecutionToStorage(params: {
  userId: string
  scopeKey: string
  instanceId?: string
  dayIndex: number
  isImpromptuMode: boolean
  execution: any
  planInstance?: any
  actions?: Record<string, any>
}) {
  const { userId, scopeKey, instanceId, dayIndex, isImpromptuMode, execution, planInstance, actions } = params
  persistTrainingExecutionSnapshot(userId, scopeKey, { execution, planInstance, actions }, { authoritative: true })
  if (!isImpromptuMode && instanceId) {
    patchExecutionInTodayTrainingPageCache(userId, instanceId, dayIndex, execution)
  }
}

/** 取消计划训练后同时清理执行页快照与今日训练首页缓存。 */
export function removeTrainingExecutionFromStorage(params: {
  userId: string
  scopeKey: string
  instanceId: string
  dayIndex: number
}) {
  const { userId, scopeKey, instanceId, dayIndex } = params
  if (!userId || !scopeKey || !instanceId) return

  const store = readStore(userId)
  if (store?.entries?.[scopeKey]) {
    const nextEntries = { ...store.entries }
    delete nextEntries[scopeKey]
    writeStore(userId, nextEntries)
  }
  removeExecutionFromTodayTrainingPageCache(userId, instanceId, dayIndex)
}
