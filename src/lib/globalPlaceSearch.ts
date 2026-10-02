import { parseLocationSearchResults, type LocationSearchResult } from '@coachlink/core'

const cache = new Map<string, { savedAt: number; results: LocationSearchResult[] }>()
const pending = new Map<string, Promise<LocationSearchResult[]>>()
let nextRequestAt = 0

export class PlaceSearchBusyError extends Error {}

export async function searchGlobalPlaces(query: string): Promise<LocationSearchResult[]> {
  // Server-only runtime setting: switch to an owned Photon-compatible service
  // without rebuilding the mini-program. No client-supplied upstream URLs.
  const endpoint = process.env.STREETLIFTING_PLACE_SEARCH_URL || 'https://photon.komoot.io/api/'
  const key = `${endpoint}:${query.toLowerCase()}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.savedAt < 24 * 60 * 60 * 1000) return cached.results
  const existing = pending.get(key)
  if (existing) return existing
  if (Date.now() < nextRequestAt) throw new PlaceSearchBusyError('搜索较忙，请稍后再试')
  nextRequestAt = Date.now() + 1500
  const work = (async () => {
    const url = new URL(endpoint)
    url.searchParams.set('q', query)
    url.searchParams.set('limit', '8')
    url.searchParams.set('lang', 'en')
    const response = await fetch(url, { headers: { 'User-Agent': 'CoachLink/1.0 (https://coachlink.fit)' }, signal: AbortSignal.timeout(8000), cache: 'no-store', redirect: 'error' })
    if (!response.ok) throw new Error('地点搜索暂不可用，请直接在地图上选点')
    const body = await response.json()
    if (!Array.isArray(body?.features)) throw new Error('地点搜索返回异常，请直接在地图上选点')
    const results = parseLocationSearchResults(body)
    cache.delete(key)
    cache.set(key, { savedAt: Date.now(), results })
    if (cache.size > 256) cache.delete(cache.keys().next().value as string)
    return results
  })()
  pending.set(key, work)
  try { return await work } finally { pending.delete(key) }
}
