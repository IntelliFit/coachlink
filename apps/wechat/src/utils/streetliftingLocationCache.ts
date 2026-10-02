import Taro from '@tarojs/taro'
import type { StreetliftingLocation } from '@/services/streetliftingIndexService'

const STORAGE_KEY = 'streetlifting_location_cache_v1'
const MAX_AGE = 60 * 24 * 60 * 60 * 1000
type Entry = { savedAt: number; value: unknown }

export type LocationListCache = {
  locations: StreetliftingLocation[]
  pagination: { page: number; limit: number; total: number }
  provinces: string[]
  countries?: string[]
}

export type LocationDraft = {
  id: string | null
  name: string
  description: string
  address: string
  country: string
  province: string
  city: string
  county: string
  latitude: number | null
  longitude: number | null
  coordinate_system: 'wgs84' | 'gcj02' | null
  image_urls: string[]
}

function readEntries(): Record<string, Entry> {
  try {
    const entries = Taro.getStorageSync(STORAGE_KEY)
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return {}
    const kept: Record<string, Entry> = {}
    Object.keys(entries).forEach((key) => {
      const entry = entries[key]
      if (entry && typeof entry.savedAt === 'number' && Number.isFinite(entry.savedAt) && Date.now() - entry.savedAt <= MAX_AGE) kept[key] = entry
    })
    return kept
  } catch { return {} }
}

export function readLocationCache<T>(key: string): T | null {
  return (readEntries()[key]?.value as T) || null
}

export function writeLocationCache(key: string, value: unknown) {
  try {
    const entries = readEntries()
    if (value == null) delete entries[key]
    else entries[key] = { savedAt: Date.now(), value }
    // Bound the public list cache; keep pending per-user drafts until expiry/success.
    Object.keys(entries).filter((item) => item.startsWith('list:')).sort((a, b) => entries[b].savedAt - entries[a].savedAt).slice(20).forEach((item) => delete entries[item])
    Object.keys(entries).filter((item) => item.startsWith('search:')).sort((a, b) => entries[b].savedAt - entries[a].savedAt).slice(20).forEach((item) => delete entries[item])
    Taro.setStorageSync(STORAGE_KEY, entries)
  } catch { /* Storage quota failures must not prevent cloud sync. */ }
}
