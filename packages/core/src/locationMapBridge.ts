/**
 * APP 的单杠地图：APP 用 WebView 打开网页 /embed/locations-map（天地图），两边靠这套消息通信。
 * 不用原生地图：谷歌地图在国内安卓上没有底图，高德、百度的 SDK 又要单独申请密钥和接入。
 * 天地图用 WGS84，所有经纬度进出地图都按 WGS84 算。
 */

export type MapBridgePin = {
  id: string
  name: string
  latitude: number
  longitude: number
  country?: string | null
  coordinate_system?: 'wgs84' | 'gcj02' | null
}

export type MapBridgeCommand =
  | { type: 'setPins'; pins: MapBridgePin[] }
  | { type: 'moveTo'; latitude: number; longitude: number; zoom?: number }
  | { type: 'showUser'; latitude: number; longitude: number }
  /** 只放标记，不触发 picked（地点已经知道，比如来自搜索结果）。 */
  | { type: 'setPicked'; latitude: number; longitude: number }
  | { type: 'pickCenter' }
  /** 让网页取定位：没有谷歌服务的安卓手机 expo-location 拿不到位置，WebView 走的是系统定位。 */
  | { type: 'locate' }

export type MapPickedAddress = { name: string; address: string; country: string; province: string; city: string; county: string }

export type MapBridgeEvent =
  | { type: 'ready' }
  | { type: 'failed'; message: string }
  | { type: 'pinPress'; id: string }
  | { type: 'located'; latitude: number; longitude: number }
  | { type: 'locateFailed' }
  /** 地图还没放大到能分辨具体位置，不接受选点。 */
  | { type: 'pickTooFar' }
  /** resolving 为 true 时位置已定、地址还在查，查到后会再发一次。 */
  | ({ type: 'picked'; latitude: number; longitude: number; resolving: boolean } & MapPickedAddress)

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

/** 消息来自网页，当成不可信数据逐项校验。 */
export function parseMapBridgeEvent(raw: string): MapBridgeEvent | null {
  let data: Record<string, unknown> | null = null
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  if (data.type === 'ready') return { type: 'ready' }
  if (data.type === 'failed') return { type: 'failed', message: text(data.message) || '地图加载失败' }
  if (data.type === 'pinPress') return typeof data.id === 'string' && data.id ? { type: 'pinPress', id: data.id } : null
  if (data.type === 'locateFailed') return { type: 'locateFailed' }
  if (data.type === 'pickTooFar') return { type: 'pickTooFar' }
  if (data.type === 'located') {
    if (!isFiniteNumber(data.latitude) || !isFiniteNumber(data.longitude)) return null
    if (Math.abs(data.latitude) > 90 || Math.abs(data.longitude) > 180) return null
    return { type: 'located', latitude: data.latitude, longitude: data.longitude }
  }
  if (data.type === 'picked') {
    if (!isFiniteNumber(data.latitude) || !isFiniteNumber(data.longitude)) return null
    if (Math.abs(data.latitude) > 90 || Math.abs(data.longitude) > 180) return null
    return {
      type: 'picked',
      latitude: data.latitude,
      longitude: data.longitude,
      resolving: Boolean(data.resolving),
      name: text(data.name),
      address: text(data.address),
      country: text(data.country),
      province: text(data.province),
      city: text(data.city),
      county: text(data.county),
    }
  }
  return null
}

/** 生成注入到 WebView 的脚本。JSON 是合法的 JS，只有这两个行分隔符要转义。 */
export function mapBridgeScript(command: MapBridgeCommand) {
  const json = JSON.stringify(command).split(String.fromCharCode(0x2028)).join('\\u2028').split(String.fromCharCode(0x2029)).join('\\u2029')
  return `window.__coachlinkMap && window.__coachlinkMap.receive(${json}); true;`
}

/** WebView 只能停留在地图页本身，点到外链不能跳走。 */
export function isMapPageUrl(url: string, baseUrl: string) {
  if (url === 'about:blank') return true
  const base = baseUrl.replace(/\/+$/, '')
  return url === `${base}/embed/locations-map` || url.startsWith(`${base}/embed/locations-map?`)
}

export type MapClusterCell<T> = { items: T[]; latitude: number; longitude: number }

/** 按屏幕像素网格分组，缩小时合并、放大时分散。 */
export function clusterMapPoints<T>(
  points: Array<{ x: number; y: number; latitude: number; longitude: number; item: T }>,
  gridPx: number,
): Array<MapClusterCell<T>> {
  const cells = new Map<string, { items: T[]; sumLat: number; sumLng: number }>()
  points.forEach((point) => {
    const key = `${Math.floor(point.x / gridPx)},${Math.floor(point.y / gridPx)}`
    const cell = cells.get(key) || { items: [], sumLat: 0, sumLng: 0 }
    cell.items.push(point.item)
    cell.sumLat += point.latitude
    cell.sumLng += point.longitude
    cells.set(key, cell)
  })
  return Array.from(cells.values()).map((cell) => ({
    items: cell.items,
    latitude: cell.sumLat / cell.items.length,
    longitude: cell.sumLng / cell.items.length,
  }))
}

/** 比这更小的缩放级别分辨不出具体位置，与小程序一致。 */
export const MIN_PICK_ZOOM = 14

const MUNICIPALITIES = ['北京', '天津', '上海', '重庆']

/** 天地图逆地理编码结果转成地址字段，直辖市的 city 常常是空的，用省补上。与网页选点组件一致。 */
export function parseTianDiTuAddress(result: { addressComponent?: Record<string, unknown>; formatted_address?: string } | null | undefined): MapPickedAddress {
  const component = result?.addressComponent || {}
  const read = (value: unknown) => (value === null || value === undefined ? '' : String(value).trim())
  const parents = (component.parents || {}) as Record<string, { name?: unknown } | undefined>
  const province = read(component.province) || read(parents.province?.name) || read(component.provinceName)
  let city = read(component.city) || read(parents.city?.name) || read(component.cityName)
  const county = read(component.county) || read(component.district) || read(parents.district?.name) || read(parents.county?.name) || read(component.area)
  if (province && !city && MUNICIPALITIES.some((name) => province === name || province === `${name}市`)) city = province
  const poi = read(component.poi)
  const address = [read(component.address), poi].filter(Boolean).join(' ') || read(result?.formatted_address)
  return { name: poi, address, country: read(component.nation), province, city, county }
}

export type DistanceOrigin = { latitude: number; longitude: number }

/** 两点直线距离（公里）。 */
export function calculateDistanceKm(from: DistanceOrigin, to: DistanceOrigin) {
  const toRadians = (degree: number) => (degree * Math.PI) / 180
  const latDelta = toRadians(to.latitude - from.latitude)
  const lngDelta = toRadians(to.longitude - from.longitude)
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(lngDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatDistanceKm(distanceKm: number) {
  return distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`
}
