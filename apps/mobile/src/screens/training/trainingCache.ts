import AsyncStorage from '@react-native-async-storage/async-storage'

const SNAPSHOT_KEY = 'training_execution_snapshots_v1'
const RETENTION_MS = 60 * 24 * 60 * 60 * 1000

type SnapshotEntry = {
  id: string
  savedAt: string
  data: any
}

function nowIso() {
  return new Date().toISOString()
}

function isFresh(entry: SnapshotEntry, now = Date.now()) {
  const savedAt = new Date(entry.savedAt).getTime()
  return Number.isFinite(savedAt) && now - savedAt <= RETENTION_MS
}

async function readAll(): Promise<Record<string, SnapshotEntry>> {
  const raw = await AsyncStorage.getItem(SNAPSHOT_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed
  } catch {}
  return {}
}

async function writeAll(entries: Record<string, SnapshotEntry>) {
  const now = Date.now()
  const next: Record<string, SnapshotEntry> = {}
  Object.entries(entries).forEach(([key, entry]) => {
    if (entry && isFresh(entry, now)) next[key] = entry
  })
  await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next))
}

export function executionSnapshotKey(params: { mode: 'plan' | 'impromptu'; id?: string; instanceId?: string; dayIndex?: number }) {
  if (params.mode === 'impromptu') return `impromptu:${params.id || ''}`
  return `plan:${params.instanceId || ''}:${params.dayIndex || 1}`
}

export async function readExecutionSnapshot(key: string): Promise<any | null> {
  const entries = await readAll()
  const entry = entries[key]
  if (!entry || !isFresh(entry)) {
    if (entry) {
      delete entries[key]
      await writeAll(entries)
    }
    return null
  }
  return entry.data
}

export async function persistExecutionSnapshot(key: string, data: any) {
  const entries = await readAll()
  entries[key] = { id: key, savedAt: nowIso(), data }
  await writeAll(entries)
}
