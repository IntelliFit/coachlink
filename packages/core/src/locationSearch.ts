import { isValidLocationCoordinates } from './locationCoordinates'

export type LocationSelection = {
  name: string
  address: string
  country: string
  province: string
  city: string
  county: string
  latitude: number
  longitude: number
  coordinate_system: 'wgs84' | 'gcj02'
}

export type LocationSearchResult = LocationSelection & { id: string; zoom: number }

const COUNTRY_NAMES: Record<string, string> = {
  CN: '中国', JP: '日本', KR: '韩国', SG: '新加坡', MY: '马来西亚', TH: '泰国', ID: '印度尼西亚',
  PH: '菲律宾', VN: '越南', IN: '印度', AE: '阿联酋', US: '美国', CA: '加拿大', MX: '墨西哥',
  BR: '巴西', GB: '英国', FR: '法国', DE: '德国', ES: '西班牙', IT: '意大利', NL: '荷兰',
  CH: '瑞士', SE: '瑞典', NO: '挪威', RU: '俄罗斯', TR: '土耳其', AU: '澳大利亚', NZ: '新西兰', ZA: '南非',
}

/** Photon GeoJSON stores longitude first. Keep its WGS84 source for saving. */
export function parseLocationSearchResults(input: unknown): LocationSearchResult[] {
  if (!input || typeof input !== 'object' || !Array.isArray((input as any).features)) return []
  const results: LocationSearchResult[] = []
  const seen = new Set<string>()
  for (const feature of (input as any).features) {
    const geometry = feature?.geometry
    const props = feature?.properties
    if (geometry?.type !== 'Point' || !Array.isArray(geometry.coordinates) || !props) continue
    const [longitude, latitude] = geometry.coordinates
    if (!isValidLocationCoordinates(latitude, longitude)) continue
    const text = (key: string) => typeof props[key] === 'string' ? props[key].trim().slice(0, 200) : ''
    const name = text('name') || text('street') || text('city')
    if (!name) continue
    const country = COUNTRY_NAMES[text('countrycode').toUpperCase()] || text('country')
    const province = text('state')
    const city = text('city') || (text('type') === 'city' ? name : '')
    const county = text('district') || text('county')
    const street = [text('street'), text('housenumber')].filter(Boolean).join(' ')
    const address = Array.from(new Set([street, county, city, province, country].filter(Boolean))).join(' · ')
    const key = `${name}:${longitude}:${latitude}:${address}`
    if (seen.has(key)) continue
    seen.add(key)
    results.push({ id: `${props.osm_type || 'place'}:${props.osm_id || key}`, name, address, country, province, city, county, latitude, longitude, coordinate_system: 'wgs84', zoom: ({ country: 5, state: 8, county: 10, city: 12 } as Record<string, number>)[text('type')] || 16 })
    if (results.length === 6) break
  }
  return results
}
