import { describe, expect, it } from 'vitest'
import { isValidLocationCoordinates, parseLocationCoordinates, toWeChatCoordinates } from '@coachlink/core'
import { validateLocationInput } from '@/app/api/streetlifting-index/locations/locationInput'

describe('international location coordinates', () => {
  it.each([
    ['51.5074', '-0.1278', 51.5074, -0.1278],
    ['-33.8688', '151.2093', -33.8688, 151.2093],
    ['0', '0', 0, 0],
    ['-90', '-180', -90, -180],
    ['90', '180', 90, 180],
  ])('accepts latitude %s and longitude %s', (lat, lon, latitude, longitude) => {
    expect(parseLocationCoordinates(lat, lon)).toEqual({ latitude, longitude })
  })
  it.each([['', '0'], ['0', ' '], ['91', '0'], ['0', '-181'], ['NaN', '0'], ['1e2', '0'], ['51N', '0'], ['51,50', '0']])('rejects invalid input %s/%s', (lat, lon) => {
    expect(parseLocationCoordinates(lat, lon)).toBeNull()
  })
  it('does not accept strings, infinities or partial coordinates in the API', () => {
    expect(isValidLocationCoordinates('0', 0)).toBe(false)
    expect(isValidLocationCoordinates(Infinity, 0)).toBe(false)
    expect(validateLocationInput({ latitude: 0 })).toBeTruthy()
    expect(validateLocationInput({ latitude: -33.8688, longitude: 151.2093, country: '澳大利亚', coordinate_system: 'wgs84' })).toBeNull()
    expect(validateLocationInput({ latitude: null, longitude: null })).toBeNull()
  })
  it('leaves overseas GPS coordinates unchanged, including Korea inside the rough China bounds', () => {
    const seoul = { latitude: 37.5665, longitude: 126.978, country: '韩国', coordinate_system: 'wgs84' as const }
    expect(toWeChatCoordinates(seoul)).toEqual(seoul)
    const london = { latitude: 51.5074, longitude: -0.1278, coordinate_system: 'wgs84' as const }
    expect(toWeChatCoordinates(london)).toEqual(london)
  })
  it('converts explicitly imported mainland GPS coordinates once, preserving native/legacy coordinates', () => {
    const beijing = { latitude: 39.915, longitude: 116.404, country: '中国', coordinate_system: 'wgs84' as const }
    const converted = toWeChatCoordinates(beijing)
    expect(converted.latitude).toBeCloseTo(39.916404, 5)
    expect(converted.longitude).toBeCloseTo(116.410244, 5)
    expect(converted.coordinate_system).toBe('gcj02')
    expect(toWeChatCoordinates(converted)).toEqual(converted)
    const legacy = { latitude: 39.915, longitude: 116.404 }
    expect(toWeChatCoordinates(legacy)).toEqual(legacy)
  })
  it('rejects unsupported coordinate metadata and overly long countries', () => {
    expect(validateLocationInput({ coordinate_system: 'bd09' as never })).toBeTruthy()
    expect(validateLocationInput({ country: 'x'.repeat(101) })).toBeTruthy()
  })
})
