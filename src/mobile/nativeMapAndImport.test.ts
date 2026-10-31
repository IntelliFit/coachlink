import { describe, expect, it } from 'vitest'
import {
  calculateDistanceKm,
  clusterMapPoints,
  formatDistanceKm,
  isMapPageUrl,
  mapBridgeScript,
  parseMapBridgeEvent,
  parseTianDiTuAddress,
} from '../../packages/core/src/locationMapBridge'
import { nearestLocations } from '../../apps/mobile/src/screens/streetlifting/locationModel'
import { planImportFileError, planImportMimeType, PLAN_IMPORT_MAX_BYTES } from '../../apps/mobile/src/screens/plan/model/planImportFile'
import { readUploadResult } from '../../apps/mobile/src/uploadResult'

describe('map bridge messages', () => {
  it('parses valid events and rejects anything else from the page', () => {
    expect(parseMapBridgeEvent('{"type":"ready"}')).toEqual({ type: 'ready' })
    expect(parseMapBridgeEvent('{"type":"pinPress","id":"p1"}')).toEqual({ type: 'pinPress', id: 'p1' })
    expect(parseMapBridgeEvent('{"type":"failed"}')).toEqual({ type: 'failed', message: '地图加载失败' })
    expect(parseMapBridgeEvent('not json')).toBeNull()
    expect(parseMapBridgeEvent('null')).toBeNull()
    expect(parseMapBridgeEvent('{"type":"pinPress","id":1}')).toBeNull()
    expect(parseMapBridgeEvent('{"type":"navigate","url":"https://evil.example"}')).toBeNull()
    expect(parseMapBridgeEvent('{"type":"picked","latitude":"39","longitude":116}')).toBeNull()
    expect(parseMapBridgeEvent('{"type":"picked","latitude":91,"longitude":116}')).toBeNull()
  })

  it('parses the page location events', () => {
    expect(parseMapBridgeEvent('{"type":"located","latitude":39.9,"longitude":116.4}')).toEqual({ type: 'located', latitude: 39.9, longitude: 116.4 })
    expect(parseMapBridgeEvent('{"type":"located","latitude":"x","longitude":116.4}')).toBeNull()
    expect(parseMapBridgeEvent('{"type":"locateFailed"}')).toEqual({ type: 'locateFailed' })
    expect(parseMapBridgeEvent('{"type":"pickTooFar"}')).toEqual({ type: 'pickTooFar' })
  })

  it('fills missing text fields of a picked point with empty strings', () => {
    expect(parseMapBridgeEvent('{"type":"picked","latitude":39.9,"longitude":116.4,"resolving":true,"name":5}')).toEqual({
      type: 'picked', latitude: 39.9, longitude: 116.4, resolving: true, name: '', address: '', country: '', province: '', city: '', county: '',
    })
  })

  it('builds an injectable script that cannot break out of the call', () => {
    const script = mapBridgeScript({ type: 'setPins', pins: [{ id: '1', name: `a");alert(1);//${String.fromCharCode(0x2028)}b`, latitude: 1, longitude: 2 }] })
    expect(script.startsWith('window.__coachlinkMap && window.__coachlinkMap.receive({')).toBe(true)
    expect(script.endsWith('); true;')).toBe(true)
    expect(script).not.toContain(String.fromCharCode(0x2028))
    const argument = script.slice(script.indexOf('receive(') + 'receive('.length, script.lastIndexOf('); true;'))
    expect(JSON.parse(argument).pins[0].name).toContain('alert(1)')
  })

  it('keeps the WebView on the map page', () => {
    const base = 'https://coachlink.fit/'
    expect(isMapPageUrl('https://coachlink.fit/embed/locations-map?mode=pick', base)).toBe(true)
    expect(isMapPageUrl('https://coachlink.fit/embed/locations-map', base)).toBe(true)
    expect(isMapPageUrl('about:blank', base)).toBe(true)
    expect(isMapPageUrl('https://coachlink.fit/login', base)).toBe(false)
    expect(isMapPageUrl('https://coachlink.fit.evil.example/embed/locations-map', base)).toBe(false)
    expect(isMapPageUrl('https://evil.example/?https://coachlink.fit/embed/locations-map', base)).toBe(false)
  })
})

describe('map clustering', () => {
  it('merges points in the same grid cell and averages the position', () => {
    const cells = clusterMapPoints([
      { x: 1, y: 1, latitude: 10, longitude: 20, item: 'a' },
      { x: 60, y: 60, latitude: 12, longitude: 22, item: 'b' },
      { x: 70, y: 1, latitude: 30, longitude: 40, item: 'c' },
    ], 64)
    expect(cells).toHaveLength(2)
    expect(cells[0]).toEqual({ items: ['a', 'b'], latitude: 11, longitude: 21 })
    expect(cells[1].items).toEqual(['c'])
  })

  it('handles an empty list', () => {
    expect(clusterMapPoints([], 64)).toEqual([])
  })
})

describe('reverse geocode address', () => {
  it('fills the city of a municipality from the province', () => {
    expect(parseTianDiTuAddress({ addressComponent: { province: '北京市', county: '海淀区', address: '学院路', poi: '学知园', nation: '中国' } })).toEqual({
      name: '学知园', address: '学院路 学知园', country: '中国', province: '北京市', city: '北京市', county: '海淀区',
    })
  })

  it('reads nested parents and falls back to the formatted address', () => {
    expect(parseTianDiTuAddress({ addressComponent: { parents: { province: { name: '江苏省' }, city: { name: '无锡市' }, district: { name: '梁溪区' } } }, formatted_address: '江苏省无锡市' })).toEqual({
      name: '', address: '江苏省无锡市', country: '', province: '江苏省', city: '无锡市', county: '梁溪区',
    })
  })

  it('returns empty fields when geocoding failed', () => {
    expect(parseTianDiTuAddress(null)).toEqual({ name: '', address: '', country: '', province: '', city: '', county: '' })
  })
})

describe('nearby locations', () => {
  it('measures distance', () => {
    expect(calculateDistanceKm({ latitude: 39.9, longitude: 116.4 }, { latitude: 39.9, longitude: 116.4 })).toBe(0)
    expect(calculateDistanceKm({ latitude: 39.9, longitude: 116.4 }, { latitude: 31.23, longitude: 121.47 })).toBeGreaterThan(1000)
    expect(formatDistanceKm(0.25)).toBe('250m')
    expect(formatDistanceKm(3.14)).toBe('3.1km')
  })

  const pin = (id: string, latitude: number, longitude: number, extra = {}) => ({ id, name: id, latitude, longitude, ...extra })
  const user = { latitude: 39.9, longitude: 116.4 }

  it('returns the closest five, nearest first', () => {
    const pins = [5, 1, 3, 2, 4, 6].map((offset) => pin(`p${offset}`, 39.9 + offset * 0.01, 116.4))
    expect(nearestLocations(user, pins, []).map((item) => item.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5'])
  })

  it('skips pins without valid coordinates', () => {
    const result = nearestLocations(user, [pin('ok', 39.91, 116.4), { id: 'bad', name: 'bad', latitude: null as any, longitude: 116.4 }], [])
    expect(result.map((item) => item.id)).toEqual(['ok'])
  })

  it('applies the equipment filter', () => {
    const pins = [pin('bar', 39.91, 116.4, { equipment_types: ['pullup_bar'], equipment_source: 'confirmed' }), pin('dip', 39.92, 116.4, { equipment_types: ['parallel_bars'], equipment_source: 'confirmed' })]
    expect(nearestLocations(user, pins as any, ['parallel_bars'] as any).map((item) => item.id)).toEqual(['dip'])
  })

  it('compares GPS with tagged GCJ-02 points in the same coordinate system', () => {
    const [tagged] = nearestLocations(user, [pin('gcj', 39.9, 116.4, { coordinate_system: 'gcj02' })], [])
    const [gps] = nearestLocations(user, [pin('wgs', 39.9, 116.4, { coordinate_system: 'wgs84' })], [])
    expect(gps.distanceKm).toBe(0)
    expect(tagged.distanceKm).toBeGreaterThan(0.1)
  })
})

describe('native upload result', () => {
  it('reads the status and JSON body', () => {
    expect(readUploadResult(200, '{"success":true}')).toEqual({ ok: true, status: 200, json: { success: true } })
    expect(readUploadResult(413, '{"message":"太大"}')).toEqual({ ok: false, status: 413, json: { message: '太大' } })
    expect(readUploadResult(502, '<html>bad gateway</html>')).toEqual({ ok: false, status: 502, json: null })
  })
})

describe('plan file import', () => {
  it('accepts the same extensions as the server', () => {
    for (const name of ['计划.TXT', 'a.csv', 'a.md', 'a.docx', 'a.xlsx', 'a.xls', 'a.pdf', 'a.png', 'a.jpg', 'a.webp']) {
      expect(planImportFileError(name, 100), name).toBe('')
    }
  })

  it('rejects other types and oversized files before uploading', () => {
    expect(planImportFileError('a.exe', 100)).toContain('.exe')
    expect(planImportFileError('noext', 100)).toContain('未知')
    expect(planImportFileError('a.pdf', PLAN_IMPORT_MAX_BYTES + 1)).toContain('10MB')
    expect(planImportFileError('a.pdf', PLAN_IMPORT_MAX_BYTES)).toBe('')
    expect(planImportFileError('a.pdf', null)).toBe('')
  })

  it('sets the type from the extension because pickers often get it wrong', () => {
    expect(planImportMimeType('a.md', null)).toBe('text/markdown')
    expect(planImportMimeType('a.docx', 'application/octet-stream')).toContain('wordprocessingml')
    expect(planImportMimeType('a.unknown', 'x/y')).toBe('x/y')
    expect(planImportMimeType('a.unknown')).toBe('application/octet-stream')
  })
})
