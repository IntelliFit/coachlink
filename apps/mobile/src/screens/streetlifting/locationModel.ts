import {
  getLocationCountry,
  inferLocationEquipment,
  isValidLocationCoordinates,
  matchesLocationEquipment,
  parseLocationCoordinates,
  resolveLocationEquipment,
  toTianDiTuCoordinates,
  toWeChatCoordinates,
  type LocationCoordinateSystem,
  type LocationEquipmentInput,
  type LocationEquipmentType,
  type LocationGap,
  type LocationSelection,
} from '@coachlink/core'
import { calculateDistanceKm, type MapBridgePin } from '@coachlink/core/src/locationMapBridge'

/**
 * 单杠点位的表单和展示规则，与小程序 streetlifting/index/locations、my-locations 一致。
 * APP 没有微信的地图选点，位置靠地点搜索（WGS84）或手动填写经纬度。
 */

export type StreetliftingLocation = LocationEquipmentInput & {
  id: string
  name: string
  description: string | null
  address: string | null
  country?: string | null
  city: string | null
  province: string | null
  county: string | null
  image_url: string | null
  image_urls: string[] | null
  latitude: number | null
  longitude: number | null
  coordinate_system?: LocationCoordinateSystem | null
  created_at: string
  user_contact?: string | null
  contributor_name_snapshot?: string | null
}

export type StreetliftingMyLocation = StreetliftingLocation & { gaps: LocationGap[] }

export type MyLocationsSummary = {
  upload_count: number
  image_count_total: number
  needs_update_count: number
  contribution_score: number | null
  rank: number | null
}

export type MyLocationsResult = { locations: StreetliftingMyLocation[]; summary: MyLocationsSummary }

export type LocationContributor = {
  contributor_key: string
  display_name: string | null
  upload_count: number
  detail_score_total: number
  image_count_total: number
  contribution_score: number
}

export type LocationOverview = {
  totalCount: number
  withImagesCount: number
  withDescriptionCount: number
  averageImageCount: number
  provinceCount: number
  mapReadyCount: number
  contributorCount: number
  topProvinces: Array<{ name: string; count: number }>
  topCities: Array<{ name: string; count: number }>
  recentMonths?: Array<{ month: string; count: number }>
}

export type LocationForm = {
  name: string
  description: string
  address: string
  country: string
  province: string
  city: string
  county: string
  latitudeText: string
  longitudeText: string
  coordinate_system: LocationCoordinateSystem | null
}

export const EMPTY_LOCATION_FORM: LocationForm = {
  name: '',
  description: '',
  address: '',
  country: '中国',
  province: '',
  city: '',
  county: '',
  latitudeText: '',
  longitudeText: '',
  coordinate_system: null,
}

export const MAX_LOCATION_IMAGES = 4
export const COUNTRY_OPTIONS = ['中国', '日本', '韩国', '新加坡', '马来西亚', '泰国', '印度尼西亚', '菲律宾', '越南', '印度', '阿联酋', '美国', '加拿大', '墨西哥', '巴西', '英国', '法国', '德国', '西班牙', '意大利', '荷兰', '瑞士', '瑞典', '挪威', '俄罗斯', '土耳其', '澳大利亚', '新西兰', '南非']

export function getLocationImages(location: Pick<StreetliftingLocation, 'image_url' | 'image_urls'>): string[] {
  if (Array.isArray(location.image_urls) && location.image_urls.length) return location.image_urls
  return location.image_url ? [location.image_url] : []
}

export function locationRegion(location: Pick<StreetliftingLocation, 'province' | 'city' | 'county' | 'address'>) {
  return Array.from(new Set([location.province, location.city, location.county].filter(Boolean))).join(' · ') || location.address || '未补充区域'
}

/** 手机号、邮箱打码后才能展示；只有昵称原样显示。 */
export function formatContributorName(value?: string | null): string {
  const trimmed = String(value || '').trim()
  if (!trimmed) return '未署名贡献者'
  if (/^1\d{10}$/.test(trimmed)) return trimmed.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
  if (trimmed.includes('@')) {
    const [name, domain] = trimmed.split('@')
    if (!name || !domain) return trimmed
    return name.length <= 2 ? `${name[0] || '*'}*@${domain}` : `${name.slice(0, 2)}***@${domain}`
  }
  return trimmed
}

export function contributorLabel(location: Pick<StreetliftingLocation, 'contributor_name_snapshot' | 'user_contact'>) {
  return formatContributorName(location.contributor_name_snapshot || location.user_contact)
}

/** 上传时署名用昵称，没有昵称才用手机号（展示时会打码）。 */
export function currentContributorContact(user: any): string | null {
  if (!user) return null
  return user.nickname || user.name || user.phone || user.phoneOrEmail || null
}

/** 有图的排前面，图多的优先，其次新上传的优先。 */
export function sortLocations<T extends StreetliftingLocation>(locations: T[]): T[] {
  const timestamp = (location: T) => {
    const value = new Date(location.created_at).getTime()
    return Number.isFinite(value) ? value : 0
  }
  return [...locations].sort((a, b) => getLocationImages(b).length - getLocationImages(a).length || timestamp(b) - timestamp(a))
}

export function formRegionLabel(form: LocationForm) {
  return Array.from(new Set([form.country, form.province, form.city, form.county].filter(Boolean))).join(' · ')
}

export function locationFormFromLocation(location: StreetliftingLocation): LocationForm {
  return {
    name: location.name || '',
    description: location.description || '',
    address: location.address || '',
    country: getLocationCountry(location),
    province: location.province || '',
    city: location.city || '',
    county: location.county || '',
    latitudeText: location.latitude === null || location.latitude === undefined ? '' : String(location.latitude),
    longitudeText: location.longitude === null || location.longitude === undefined ? '' : String(location.longitude),
    coordinate_system: location.coordinate_system || null,
  }
}

/** 已确认器材的点位直接显示；其余按名称和描述预选，由用户核对。 */
export function initialEquipment(location: StreetliftingLocation | null, form: LocationForm): { types: LocationEquipmentType[]; touched: boolean } {
  if (location) {
    const resolved = resolveLocationEquipment(location)
    return { types: resolved.equipment_types, touched: resolved.equipment_source === 'confirmed' }
  }
  return { types: inferLocationEquipment(form), touched: false }
}

const AUTO_TEXT_FIELDS = ['name', 'address', 'province', 'city', 'county'] as const
export type LocationAutoFields = Partial<Record<(typeof AUTO_TEXT_FIELDS)[number], string>>

/**
 * 选中搜索结果：替换之前自动带入的文字，保留用户改过的内容（与小程序 mergePickedLocation 一致）；
 * 只有行政区划时不算详细地址（usableSearchSelection）。
 */
export function applyPlaceSelection(form: LocationForm, place: LocationSelection, autoFilled: LocationAutoFields = {}): { form: LocationForm; autoFilled: LocationAutoFields } {
  const areas = [place.country, place.province, place.city, place.county].filter(Boolean)
  const addressParts = place.address.split(' · ').filter(Boolean)
  const usable: LocationSelection = { ...place, address: addressParts.length && addressParts.every((part) => areas.includes(part)) ? '' : place.address }
  const next: LocationForm = { ...form }
  const nextAuto: LocationAutoFields = {}
  for (const field of AUTO_TEXT_FIELDS) {
    const current = form[field] || ''
    if (!current.trim() || current === autoFilled[field]) {
      next[field] = usable[field]
      nextAuto[field] = usable[field]
    }
  }
  return {
    form: {
      ...next,
      country: usable.country || form.country,
      latitudeText: String(usable.latitude),
      longitudeText: String(usable.longitude),
      coordinate_system: usable.coordinate_system,
    },
    autoFilled: nextAuto,
  }
}

/** 解析表单里的位置；都没填返回 null 坐标，只填一半或超范围返回错误。 */
export function parseFormPosition(form: LocationForm): { latitude: number | null; longitude: number | null; error?: string } {
  const latitudeText = form.latitudeText.trim()
  const longitudeText = form.longitudeText.trim()
  if (!latitudeText && !longitudeText) return { latitude: null, longitude: null }
  const parsed = parseLocationCoordinates(latitudeText, longitudeText)
  if (!parsed) return { latitude: null, longitude: null, error: '请填写有效经纬度：纬度 -90～90，经度 -180～180' }
  return parsed
}

export function formHasPosition(form: LocationForm) {
  const position = parseFormPosition(form)
  return !position.error && isValidLocationCoordinates(position.latitude, position.longitude)
}

export function validateLocationForm(form: LocationForm): string | null {
  if (!form.name.trim()) return '请填写地点名称'
  if (!form.country.trim()) return '请填写国家/地区'
  return parseFormPosition(form).error || null
}

/** 创建和更新共用的字段；器材没选且没动过时不传，避免把「据描述」写成已确认。 */
export function buildLocationPayload(form: LocationForm, imageUrls: string[], equipment: { types: LocationEquipmentType[]; touched: boolean }) {
  const position = parseFormPosition(form)
  const hasPosition = position.latitude !== null && position.longitude !== null
  return {
    name: form.name.trim(),
    country: form.country.trim(),
    equipment_types: equipment.types.length || equipment.touched ? equipment.types : undefined,
    latitude: position.latitude,
    longitude: position.longitude,
    coordinate_system: hasPosition ? form.coordinate_system : null,
    description: form.description.trim() || null,
    address: form.address.trim() || null,
    province: form.province.trim() || null,
    city: form.city.trim() || null,
    county: form.county.trim() || null,
    image_urls: imageUrls.length ? imageUrls : null,
  }
}

/** 删除后本地先去掉这条，排名和贡献分等下次加载刷新。 */
export function withoutLocation(data: MyLocationsResult, id: string): MyLocationsResult {
  const removed = data.locations.find((location) => location.id === id)
  if (!removed) return data
  return {
    locations: data.locations.filter((location) => location.id !== id),
    summary: {
      ...data.summary,
      upload_count: Math.max(0, data.summary.upload_count - 1),
      image_count_total: Math.max(0, data.summary.image_count_total - getLocationImages(removed).length),
      needs_update_count: Math.max(0, data.summary.needs_update_count - (removed.gaps.length ? 1 : 0)),
    },
  }
}

export function formatRate(part: number, total: number) {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : '0%'
}

export function formatMonthLabel(month: string) {
  const value = Number(String(month).split('-')[1])
  return Number.isFinite(value) && value > 0 ? `${value}月` : month
}

/** 判断表单是否改过：器材还在自动推断时不算修改。 */
export function locationDraftSnapshot(form: LocationForm, imageUrls: string[], equipmentTouched: boolean, equipment: LocationEquipmentType[]) {
  return JSON.stringify({ form, imageUrls, equipment: equipmentTouched ? equipment : null })
}

/** 打开系统地图用的坐标：国内地图都用 GCJ-02，与小程序 openLocation 一样，GPS 坐标要先转换。 */
export function systemMapCoordinates(location: { latitude: number; longitude: number; coordinate_system?: LocationCoordinateSystem | null; country?: string | null }) {
  const { latitude, longitude } = toWeChatCoordinates(location)
  return { latitude, longitude }
}

let locationsChanged = false

/** 点位被新增、编辑或删除后调用，列表页回到前台时才知道要刷新。 */
export function markLocationsChanged() {
  locationsChanged = true
}

export function consumeLocationsChanged() {
  const changed = locationsChanged
  locationsChanged = false
  return changed
}

export type LocationMapPin = MapBridgePin & LocationEquipmentInput & Pick<StreetliftingLocation, 'province' | 'city' | 'county' | 'address'>
export type NearbyLocation<T extends MapBridgePin = LocationMapPin> = T & { distanceKm: number }

/** 离你最近的 5 个点位，与小程序一样。手机定位是 WGS84，点位可能存的是 GCJ-02，先统一再算距离，否则国内差几百米。 */
export function nearestLocations<T extends MapBridgePin & LocationEquipmentInput>(user: { latitude: number; longitude: number }, pins: T[], equipment: LocationEquipmentType[]): Array<NearbyLocation<T>> {
  return pins
    .filter((pin) => isValidLocationCoordinates(pin.latitude, pin.longitude) && matchesLocationEquipment(pin, equipment))
    .map((pin) => ({ ...pin, distanceKm: calculateDistanceKm(user, toTianDiTuCoordinates(pin)) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 5)
}
