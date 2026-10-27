import { describe, expect, it } from 'vitest'
import { gcj02ToWgs84, toTianDiTuCoordinates, toWeChatCoordinates, wgs84ToGcj02 } from '@coachlink/core'
import { resolveCoordinateSystem } from '../app/api/streetlifting-index/locations/locationInput'

const peoplesParkGcj = { latitude: 31.2324, longitude: 121.4723 }

function metres(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const r = (x: number) => x * Math.PI / 180
  const h = Math.sin(r(b.latitude - a.latitude) / 2) ** 2 + Math.cos(r(a.latitude)) * Math.cos(r(b.latitude)) * Math.sin(r(b.longitude - a.longitude) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

describe('GCJ-02 ⇄ WGS84', () => {
  it('round-trips within a few centimetres', () => {
    const back = wgs84ToGcj02(gcj02ToWgs84(peoplesParkGcj))
    expect(metres(back, peoplesParkGcj)).toBeLessThan(0.05)
  })

  it('moves Shanghai points by the expected few hundred metres', () => {
    const offset = metres(gcj02ToWgs84(peoplesParkGcj), peoplesParkGcj)
    expect(offset).toBeGreaterThan(300)
    expect(offset).toBeLessThan(800)
  })

  it('converts only tagged mini-program points for Tianditu', () => {
    expect(toTianDiTuCoordinates({ ...peoplesParkGcj, coordinate_system: 'gcj02' })).toMatchObject({ coordinate_system: 'wgs84' })
    expect(toTianDiTuCoordinates({ ...peoplesParkGcj, coordinate_system: null })).toEqual({ ...peoplesParkGcj, coordinate_system: null })
    expect(toTianDiTuCoordinates({ ...peoplesParkGcj, coordinate_system: 'wgs84' })).toEqual({ ...peoplesParkGcj, coordinate_system: 'wgs84' })
  })

  it('leaves overseas points alone in both directions', () => {
    const tokyo = { latitude: 35.67, longitude: 139.69, country: '日本', coordinate_system: 'gcj02' as const }
    expect(toTianDiTuCoordinates(tokyo)).toEqual(tokyo)
    expect(toWeChatCoordinates({ ...tokyo, coordinate_system: 'wgs84' })).toEqual({ ...tokyo, coordinate_system: 'wgs84' })
  })

  it('keeps WeChat display of WGS84 points unchanged by the refactor', () => {
    const converted = toWeChatCoordinates({ latitude: 39.9087, longitude: 116.3975, coordinate_system: 'wgs84' as const })
    expect(converted.coordinate_system).toBe('gcj02')
    expect(converted).toMatchObject(wgs84ToGcj02({ latitude: 39.9087, longitude: 116.3975 }))
  })
})

describe('server coordinate-system tagging', () => {
  const weapp = new Request('https://coachlink.fit/x', { headers: { referer: 'https://servicewechat.com/wx123/45/page-frame.html' } })
  const web = new Request('https://coachlink.fit/x', { headers: { referer: 'https://coachlink.fit/streetlifting-index/locations' } })

  it('trusts an explicit client value', () => {
    expect(resolveCoordinateSystem(web, { latitude: 31, longitude: 121, coordinate_system: 'wgs84' })).toBe('wgs84')
    expect(resolveCoordinateSystem(weapp, { latitude: 31, longitude: 121, coordinate_system: null })).toBeNull()
  })

  it('tags untagged mini-program coordinates as GCJ-02 and others as unknown', () => {
    expect(resolveCoordinateSystem(weapp, { latitude: 31, longitude: 121 })).toBe('gcj02')
    expect(resolveCoordinateSystem(web, { latitude: 31, longitude: 121 })).toBeNull()
  })

  it('does not touch the tag when coordinates are not sent, and clears it when they are removed', () => {
    expect(resolveCoordinateSystem(weapp, {})).toBeUndefined()
    expect(resolveCoordinateSystem(weapp, { latitude: null, longitude: null, coordinate_system: 'gcj02' })).toBeNull()
  })
})
