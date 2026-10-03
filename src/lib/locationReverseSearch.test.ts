import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('nearby address lookup', () => {
  beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-03T00:00:00Z')) })
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers() })
  it('uses the configured reverse endpoint and keeps southern/western coordinate order', async () => {
    vi.stubEnv('STREETLIFTING_PLACE_SEARCH_URL', 'https://places.example/photon/api/')
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [] }) })
    vi.stubGlobal('fetch', fetch)
    const { reverseGlobalPlace } = await import('./globalPlaceSearch')
    await reverseGlobalPlace(-33.9, -70.7)
    const url = fetch.mock.calls[0][0] as URL
    expect(url.pathname).toBe('/photon/reverse')
    expect(url.searchParams.get('lat')).toBe('-33.9')
    expect(url.searchParams.get('lon')).toBe('-70.7')
    expect(url.searchParams.has('q')).toBe(false)
  })
  it('coalesces and caches address reads but keeps forward searches separate', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [] }) })
    vi.stubGlobal('fetch', fetch)
    const { reverseGlobalPlace, searchGlobalPlaces } = await import('./globalPlaceSearch')
    await Promise.all([reverseGlobalPlace(35.67, 139.69), reverseGlobalPlace(35.67, 139.69)])
    await reverseGlobalPlace(35.67, 139.69)
    expect(fetch).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1500)
    await searchGlobalPlaces('Tokyo')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
