export type LocationCoordinateSystem = 'wgs84' | 'gcj02'

export type LocationCoordinates = { latitude: number; longitude: number }

/** Decimal coordinates, including zero, southern latitudes and western longitudes. */
export function parseLocationCoordinates(latitude: string, longitude: string): LocationCoordinates | null {
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
  if (!decimal.test(latitude.trim()) || !decimal.test(longitude.trim())) return null
  const coordinates = { latitude: Number(latitude), longitude: Number(longitude) }
  return isValidLocationCoordinates(coordinates.latitude, coordinates.longitude) ? coordinates : null
}

export function isValidLocationCoordinates(latitude: unknown, longitude: unknown): boolean {
  return typeof latitude === 'number' && Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180
}

type CoordinateTagged = LocationCoordinates & { coordinate_system?: LocationCoordinateSystem | null; country?: string | null }

/** GCJ-02 only differs from WGS84 inside China; elsewhere both are identical. */
function usesChinaOffset(location: CoordinateTagged): boolean {
  const { latitude: lat, longitude: lon } = location
  // A country explicitly outside mainland China wins over the rough bounding box.
  if (location.country && !['中国', '中国大陆', 'China', 'CN'].includes(location.country.trim())) return false
  return lon >= 72.004 && lon <= 137.8347 && lat >= 0.8293 && lat <= 55.8271
}

/** Keep legacy/native coordinates as-is; convert explicitly imported GPS coordinates for WeChat. */
export function toWeChatCoordinates<T extends CoordinateTagged>(location: T): Omit<T, 'coordinate_system'> & { coordinate_system?: LocationCoordinateSystem | null } {
  if (location.coordinate_system !== 'wgs84' || !usesChinaOffset(location)) return location
  return { ...location, ...wgs84ToGcj02(location), coordinate_system: 'gcj02' }
}

/** Tianditu (CGCS2000 ≈ WGS84) needs WeChat/GCJ-02 points converted back; untagged legacy
 * points keep the web's historical WGS84 assumption. */
export function toTianDiTuCoordinates<T extends CoordinateTagged>(location: T): Omit<T, 'coordinate_system'> & { coordinate_system?: LocationCoordinateSystem | null } {
  if (location.coordinate_system !== 'gcj02' || !usesChinaOffset(location)) return location
  return { ...location, ...gcj02ToWgs84(location), coordinate_system: 'wgs84' }
}

/** Inverse of wgs84ToGcj02 by fixed-point iteration (sub-centimetre after a few rounds). */
export function gcj02ToWgs84({ latitude, longitude }: LocationCoordinates): LocationCoordinates {
  let wgs = { latitude, longitude }
  for (let i = 0; i < 5; i++) {
    const gcj = wgs84ToGcj02(wgs)
    wgs = { latitude: wgs.latitude - (gcj.latitude - latitude), longitude: wgs.longitude - (gcj.longitude - longitude) }
  }
  return wgs
}

export function wgs84ToGcj02({ latitude: lat, longitude: lon }: LocationCoordinates): LocationCoordinates {
  const x = lon - 105, y = lat - 35
  const pi = Math.PI
  let dlat = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  dlat += (20 * Math.sin(6 * x * pi) + 20 * Math.sin(2 * x * pi)) * 2 / 3
  dlat += (20 * Math.sin(y * pi) + 40 * Math.sin(y / 3 * pi)) * 2 / 3
  dlat += (160 * Math.sin(y / 12 * pi) + 320 * Math.sin(y * pi / 30)) * 2 / 3
  let dlon = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  dlon += (20 * Math.sin(6 * x * pi) + 20 * Math.sin(2 * x * pi)) * 2 / 3
  dlon += (20 * Math.sin(x * pi) + 40 * Math.sin(x / 3 * pi)) * 2 / 3
  dlon += (150 * Math.sin(x / 12 * pi) + 300 * Math.sin(x / 30 * pi)) * 2 / 3
  const radlat = lat / 180 * pi
  const magic = 1 - 0.00669342162296594323 * Math.sin(radlat) ** 2
  const sqrtMagic = Math.sqrt(magic)
  dlat = dlat * 180 / ((6378245 * (1 - 0.00669342162296594323)) / (magic * sqrtMagic) * pi)
  dlon = dlon * 180 / (6378245 / sqrtMagic * Math.cos(radlat) * pi)
  return { latitude: lat + dlat, longitude: lon + dlon }
}
