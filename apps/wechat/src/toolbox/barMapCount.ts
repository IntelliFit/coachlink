import Taro from '@tarojs/taro'
import { streetliftingIndexService } from '@/services/streetliftingIndexService'

// "全国 N 个点位" on the toolbox hero. Points grow by 100+ a day, so the cache is
// short-lived and the bar map page writes back every total it loads; losing the
// cache only hides the number until the next refresh.
const STORAGE_KEY = 'toolbox_bar_map_count_v1'
const REFRESH_INTERVAL_MS = 10 * 60 * 1000

type CachedCount = { count: number; fetchedAt: number }

function readCache(): CachedCount | null {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY)
    if (raw && typeof raw.count === 'number' && typeof raw.fetchedAt === 'number') return raw as CachedCount
  } catch {
    // ignore unreadable cache
  }
  return null
}

export function readCachedBarMapCount(): number | null {
  return readCache()?.count ?? null
}

/** Stores a total the bar map page just loaded, so the toolbox shows the same number. */
export function rememberBarMapCount(count: number): void {
  if (!Number.isFinite(count) || count <= 0) return
  try {
    const next: CachedCount = { count, fetchedAt: Date.now() }
    Taro.setStorageSync(STORAGE_KEY, next)
  } catch {
    // cache write failure is harmless
  }
}

/** Resolves to a fresh count when the cache is stale, otherwise to null (keep what is shown). */
export async function refreshBarMapCountIfStale(): Promise<number | null> {
  const cached = readCache()
  if (cached && Date.now() - cached.fetchedAt < REFRESH_INTERVAL_MS) return null
  const count = await streetliftingIndexService.countLocations().catch(() => null)
  if (count === null) return null
  rememberBarMapCount(count)
  return count
}
