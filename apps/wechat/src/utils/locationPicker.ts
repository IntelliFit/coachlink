import { CHINA_PROVINCE_NAMES, isValidLocationCoordinates, toWeChatCoordinates, type LocationSelection } from '@coachlink/core'

const TEXT_FIELDS = ['name', 'address', 'province', 'city', 'county'] as const
export type PickerAutoFields = Partial<Pick<LocationSelection, typeof TEXT_FIELDS[number]>>
type Point = { latitude: number | null; longitude: number | null; coordinate_system?: 'gcj02' | 'wgs84' | null; country?: string | null; province?: string | null; city?: string | null }

/** Native WeChat supplies a full Chinese address, but no structured region fields. */
export function parseNativeLocation(result: { name?: string; address?: string; latitude: number; longitude: number }): LocationSelection {
  const address = (result.address || '').trim()
  const province = [...CHINA_PROVINCE_NAMES].sort((a, b) => b.length - a.length).find(value => address.startsWith(value)) || ''
  let rest = address.slice(province.length)
  const municipality = /^(北京|天津|上海|重庆)(市)?$/.test(province)
  const normalizedProvince = municipality ? province.replace(/市?$/, '市') : province
  const city = municipality ? normalizedProvince : rest.match(/^(.{2,16}?(?:自治州|地区|盟|市))/)?.[1] || ''
  if (city && rest.startsWith(city)) rest = rest.slice(city.length)
  const county = rest.match(/^(.{1,12}?(?:自治县|自治旗|区|县|旗))/)?.[1] || ''
  return { name: (result.name || '').trim(), address, country: '中国', province: normalizedProvince, city, county, latitude: result.latitude, longitude: result.longitude, coordinate_system: 'gcj02' }
}

/** Replace previously automatic values, while retaining fields the user corrected. */
export function mergePickedLocation<T extends PickerAutoFields & Point>(form: T, position: LocationSelection, autoFilled: PickerAutoFields = {}): { form: T; autoFilled: PickerAutoFields } {
  const updates: PickerAutoFields = {}
  const nextAuto: PickerAutoFields = {}
  for (const field of TEXT_FIELDS) {
    const current = form[field] || ''
    if (!current.trim() || current === autoFilled[field]) {
      updates[field] = position[field]
      nextAuto[field] = position[field]
    }
  }
  return { form: { ...form, ...updates, latitude: position.latitude, longitude: position.longitude, coordinate_system: position.coordinate_system }, autoFilled: nextAuto }
}

/** Photon can supply only an administrative area; do not call that a detailed address. */
export function usableSearchSelection(position: LocationSelection): LocationSelection {
  const areas = [position.country, position.province, position.city, position.county].filter(Boolean)
  const addressParts = position.address.split(' · ').filter(Boolean)
  return { ...position, address: addressParts.length && addressParts.every(part => areas.includes(part)) ? '' : position.address }
}

export function getPickerStart(current: Point | null, nearby: Point | null) {
  const candidates = [current, nearby]
  for (const point of candidates) {
    if (point && isValidLocationCoordinates(point.latitude, point.longitude)) return toWeChatCoordinates({ ...point, latitude: point.latitude!, longitude: point.longitude! })
  }
  return null
}
