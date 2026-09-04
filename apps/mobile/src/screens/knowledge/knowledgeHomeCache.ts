import AsyncStorage from '@react-native-async-storage/async-storage'

type KnowledgeCacheStorage = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<unknown>
}

export const KNOWLEDGE_HOME_CACHE_KEY = 'knowledge_home_cache_v1'
export const KNOWLEDGE_HOME_CACHE_RETENTION_MS = 60 * 24 * 60 * 60 * 1000

export type KnowledgeHomeCachePayload = {
  plans: any[]
  books: any[]
  articles: any[]
}

type KnowledgeHomeCacheEntry = KnowledgeHomeCachePayload & {
  savedAt: number
}

type KnowledgeHomeCacheStore = {
  v: 1
  entries: Record<string, KnowledgeHomeCacheEntry>
}

function emptyStore(): KnowledgeHomeCacheStore {
  return { v: 1, entries: {} }
}

function normalizeList(value: unknown): any[] {
  return Array.isArray(value) ? value : []
}

function isFresh(savedAt: unknown, now: number) {
  const value = Number(savedAt)
  return Number.isFinite(value) && value > 0 && now - value <= KNOWLEDGE_HOME_CACHE_RETENTION_MS
}

function normalizeStore(value: unknown, now = Date.now()): KnowledgeHomeCacheStore {
  if (!value || typeof value !== 'object') return emptyStore()
  const source = value as { v?: unknown; entries?: unknown }
  if (source.v !== 1 || !source.entries || typeof source.entries !== 'object') return emptyStore()

  const entries: Record<string, KnowledgeHomeCacheEntry> = {}
  for (const [scope, rawEntry] of Object.entries(source.entries as Record<string, unknown>)) {
    if (!rawEntry || typeof rawEntry !== 'object') continue
    const entry = rawEntry as Partial<KnowledgeHomeCacheEntry>
    if (!isFresh(entry.savedAt, now)) continue
    entries[scope] = {
      savedAt: Number(entry.savedAt),
      plans: normalizeList(entry.plans),
      books: normalizeList(entry.books),
      articles: normalizeList(entry.articles),
    }
  }
  return { v: 1, entries }
}

async function readStore(
  now = Date.now(),
  storage: KnowledgeCacheStorage = AsyncStorage,
): Promise<KnowledgeHomeCacheStore> {
  try {
    const raw = await storage.getItem(KNOWLEDGE_HOME_CACHE_KEY)
    if (!raw) return emptyStore()
    return normalizeStore(JSON.parse(raw), now)
  } catch {
    return emptyStore()
  }
}

export function knowledgeHomeCacheScope(userId?: string | null) {
  const normalized = String(userId || '').trim()
  return normalized ? `user:${normalized}` : 'guest'
}

export async function readKnowledgeHomeCache(
  scope: string,
  now = Date.now(),
  storage: KnowledgeCacheStorage = AsyncStorage,
): Promise<KnowledgeHomeCachePayload | null> {
  const store = await readStore(now, storage)
  const entry = store.entries[scope]
  if (!entry) return null
  return {
    plans: [...entry.plans],
    books: [...entry.books],
    articles: [...entry.articles],
  }
}

export async function writeKnowledgeHomeCache(
  scope: string,
  payload: KnowledgeHomeCachePayload,
  now = Date.now(),
  storage: KnowledgeCacheStorage = AsyncStorage,
): Promise<void> {
  const store = await readStore(now, storage)
  store.entries[scope] = {
    savedAt: now,
    plans: normalizeList(payload.plans).slice(0, 8),
    books: normalizeList(payload.books).slice(0, 4),
    articles: normalizeList(payload.articles).slice(0, 6),
  }
  await storage.setItem(KNOWLEDGE_HOME_CACHE_KEY, JSON.stringify(store))
}
