import { describe, expect, it } from 'vitest'
import { fitLocationMapPoints, getGestureMapScale, getInitialLocationMapView, getLocationCountry } from '@coachlink/core'

describe('location browsing defaults and native camera events', () => {
  const chinesePins = [
    { latitude: 39.9, longitude: 116.4, province: '北京市' },
    { latitude: 31.2, longitude: 121.5, province: '上海' },
    { latitude: 23.1, longitude: 113.3, province: '广东省' },
    { latitude: 51.5, longitude: -0.1, country: '英国' },
  ]
  it('starts over existing Chinese locations rather than an empty continental midpoint', () => {
    const view = getInitialLocationMapView(chinesePins)
    expect(view.latitude).toBeGreaterThan(23)
    expect(view.latitude).toBeLessThan(40)
    expect(view.longitude).toBeGreaterThan(113)
    expect(view.longitude).toBeLessThan(122)
  })
  it('prioritizes a user abroad, including southern and western coordinates', () => {
    expect(getInitialLocationMapView(chinesePins, { latitude: -33.9, longitude: -70.7 })).toEqual({ latitude: -33.9, longitude: -70.7, scale: 13 })
  })
  it('falls back to China with no saved points and tolerates invalid positions', () => {
    expect(getInitialLocationMapView([{ latitude: NaN, longitude: 0 }], { latitude: 99, longitude: 0 })).toEqual({ latitude: 35, longitude: 105, scale: 4 })
  })
  it('fits points on both sides of the date line around the Pacific', () => {
    const view = fitLocationMapPoints([{ latitude: -17, longitude: 179 }, { latitude: -18, longitude: -179 }])
    expect(Math.abs(view.longitude)).toBe(180)
    expect(view.scale).toBeGreaterThan(5)
  })
  it('ignores programmatic updates and missing/invalid scales instead of resetting the camera', () => {
    expect(getGestureMapScale({ detail: { type: 'end', causedBy: 'update', scale: 3 } })).toBeNull()
    expect(getGestureMapScale({ detail: { type: 'end', causedBy: 'scale' } })).toBeNull()
    expect(getGestureMapScale({ detail: { type: 'end', causedBy: 'scale', scale: NaN } })).toBeNull()
    expect(getGestureMapScale({ detail: { type: 'end', causedBy: 'scale', scale: 15.6 } })).toBe(15.6)
  })
})

describe('legacy country facets', () => {
  it('identifies recognized Chinese provinces without altering coordinate metadata', () => {
    const old = { province: '北京市', country: null, coordinate_system: null }
    expect(getLocationCountry(old)).toBe('中国')
    expect(old).toEqual({ province: '北京市', country: null, coordinate_system: null })
  })
  it('does not classify foreign or unknown country-less points as Chinese', () => {
    expect(getLocationCountry({ province: 'California' })).toBe('')
    expect(getLocationCountry({})).toBe('')
    expect(getLocationCountry({ country: '日本', province: '北京市' })).toBe('日本')
  })
})
