import AsyncStorage from '@react-native-async-storage/async-storage'
import { patchExecutionInTodayTrainingCache } from './todayTrainingCache'

const SNAPSHOT_KEY = 'training_execution_snapshots_v1'
const RETENTION_MS = 60 * 24 * 60 * 60 * 1000

export type SnapshotEntry = {
  savedAt: number
  execution: unknown
  planInstance?: unknown
  actions?: Record<string, unknown>
}

type SnapshotStore = {
  v: 1
  userId: string
  entries: Record<string, SnapshotEntry>
}

function isFresh(entry: SnapshotEntry, now = Date.now()) {
  return Number.isFinite(entry.savedAt) && now - entry.savedAt <= RETENTION_MS
}

function prune(entries: Record<string, SnapshotEntry>, now = Date.now()) {
  return Object.fromEntries(
    Object.entries(entries).filter(([, entry]) => entry && isFresh(entry, now)),
  )
}

async function writeStore(userId: string, entries: Record<string, SnapshotEntry>) {
  await AsyncStorage.setItem(
    SNAPSHOT_KEY,
    JSON.stringify({ v: 1, userId, entries: prune(entries) } satisfies SnapshotStore),
  )
}

async function readStore(userId: string): Promise<SnapshotStore | null> {
  if (!userId) return null
  const raw = await AsyncStorage.getItem(SNAPSHOT_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as SnapshotStore
    if (parsed?.v !== 1 || String(parsed.userId || '') !== String(userId) || !parsed.entries) return null
    const entries = prune(parsed.entries)
    if (Object.keys(entries).length !== Object.keys(parsed.entries).length) {
      await writeStore(userId, entries)
    }
    return { ...parsed, entries }
  } catch {
    await AsyncStorage.removeItem(SNAPSHOT_KEY)
    return null
  }
}

export function executionSnapshotKey(params: { mode: 'plan' | 'impromptu'; id?: string; instanceId?: string; dayIndex?: number }) {
  if (params.mode === 'impromptu') return `impromptu:${params.id || ''}`
  return `plan:${params.instanceId || ''}:${params.dayIndex || 1}`
}

export async function readExecutionSnapshot(userId: string, key: string): Promise<unknown | null> {
  const entry = (await readStore(userId))?.entries[key]
  return entry && isFresh(entry) ? entry.execution : null
}

export async function readExecutionSnapshotEntry(
  userId: string,
  key: string,
): Promise<SnapshotEntry | null> {
  const entry = (await readStore(userId))?.entries[key]
  return entry && isFresh(entry) ? entry : null
}

export async function findLatestInProgressImpromptuSnapshot(userId: string): Promise<{
  key: string
  execution: any
  savedAt: number
} | null> {
  const entries = (await readStore(userId))?.entries || {}
  const match = Object.entries(entries)
    .filter(([key, entry]) => {
      const execution = (entry.execution as any)?.execution || entry.execution
      return key.startsWith('impromptu:') && String(execution?.status || '').toLowerCase() === 'in_progress'
    })
    .sort(([, left], [, right]) => right.savedAt - left.savedAt)[0]
  if (!match) return null
  const [key, entry] = match
  return { key, execution: (entry.execution as any)?.execution || entry.execution, savedAt: entry.savedAt }
}

export async function persistExecutionSnapshot(
  userId: string,
  key: string,
  execution: unknown,
  extra?: Pick<SnapshotEntry, 'planInstance' | 'actions'>,
) {
  if (!userId || !key || !execution) return
  const entries = (await readStore(userId))?.entries || {}
  const previous = entries[key]
  entries[key] = {
    savedAt: Date.now(),
    execution,
    planInstance: extra?.planInstance ?? previous?.planInstance,
    actions: extra?.actions ?? previous?.actions,
  }
  await writeStore(userId, entries)
}

export async function syncTrainingExecutionToCache(params: {
  userId: string
  key: string
  isImpromptu: boolean
  instanceId?: string
  dayIndex: number
  execution: unknown
}) {
  await Promise.all([
    persistExecutionSnapshot(params.userId, params.key, params.execution),
    !params.isImpromptu && params.instanceId
      ? patchExecutionInTodayTrainingCache(
          params.userId,
          params.instanceId,
          params.dayIndex,
          params.execution,
        )
      : Promise.resolve(),
  ])
}

export async function removeExecutionSnapshot(userId: string, key: string) {
  if (!userId || !key) return
  const entries = (await readStore(userId))?.entries || {}
  if (!(key in entries)) return
  const { [key]: _removed, ...rest } = entries
  await writeStore(userId, rest)
}
