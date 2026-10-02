import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseLocationSearchResults } from '@coachlink/core'

const tokyo = { geometry: { type: 'Point', coordinates: [139.6951716, 35.6714052] }, properties: { name: 'Yoyogi Park', country: 'Japan', countrycode: 'JP', city: 'Tokyo', osm_id: 42, osm_type: 'W' } }

describe('overseas place search coordinates', () => {
  it('uses GeoJSON longitude/latitude order and saves the original WGS84 source', () => {
    const [result] = parseLocationSearchResults({ features: [tokyo] })
    expect(result).toMatchObject({ latitude: 35.6714052, longitude: 139.6951716, country: '日本', coordinate_system: 'wgs84', city: 'Tokyo' })
  })
  it('preserves southern and western coordinates and city zoom', () => {
    const results = parseLocationSearchResults({ features: [
      { geometry: { type: 'Point', coordinates: [-0.1278, 51.5074] }, properties: { name: 'London', countrycode: 'gb', type: 'city' } },
      { geometry: { type: 'Point', coordinates: [151.2093, -33.8688] }, properties: { name: 'Sydney', countrycode: 'AU', type: 'city' } },
    ] })
    expect(results[0]).toMatchObject({ longitude: -0.1278, country: '英国', city: 'London', zoom: 12 })
    expect(results[1]).toMatchObject({ latitude: -33.8688, country: '澳大利亚' })
  })
  it('rejects malformed/out-of-range coordinates and duplicate candidates', () => {
    expect(parseLocationSearchResults({ features: [tokyo, tokyo, { ...tokyo, geometry: { type: 'Point', coordinates: [181, 35] } }, { ...tokyo, geometry: { type: 'Point', coordinates: ['139', '35'] } }, { ...tokyo, geometry: { type: 'Polygon', coordinates: [] } }] })).toHaveLength(1)
    expect(parseLocationSearchResults(null)).toEqual([])
  })
})

describe('global search upstream boundary', () => {
  beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-03T00:00:00Z')) })
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers() })
  it('caches identical user searches without sending another external request', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [tokyo] }) })
    vi.stubGlobal('fetch', fetch)
    const { searchGlobalPlaces } = await import('./globalPlaceSearch')
    expect(await searchGlobalPlaces('Yoyogi Park')).toHaveLength(1)
    expect(await searchGlobalPlaces('yoyogi park')).toHaveLength(1)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('throttles rapid distinct searches without calling the upstream', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [tokyo] }) })
    vi.stubGlobal('fetch', fetch)
    const { searchGlobalPlaces, PlaceSearchBusyError } = await import('./globalPlaceSearch')
    await searchGlobalPlaces('Tokyo')
    await expect(searchGlobalPlaces('London')).rejects.toBeInstanceOf(PlaceSearchBusyError)
    expect(fetch).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1500)
    await searchGlobalPlaces('London')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('retries a failed search and can switch upstream through server config', async () => {
    vi.stubEnv('STREETLIFTING_PLACE_SEARCH_URL', 'https://search.example/api/')
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ features: [tokyo] }) })
    vi.stubGlobal('fetch', fetch)
    const { searchGlobalPlaces } = await import('./globalPlaceSearch')
    await expect(searchGlobalPlaces('Tokyo & Japan')).rejects.toThrow()
    vi.advanceTimersByTime(1500)
    await searchGlobalPlaces('Tokyo & Japan')
    const url = fetch.mock.calls[1][0] as URL
    expect(url.origin).toBe('https://search.example')
    expect(url.searchParams.get('q')).toBe('Tokyo & Japan')
  })
})
