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

/** Keep legacy/native coordinates as-is; convert explicitly imported GPS coordinates for WeChat. */
export function toWeChatCoordinates<T extends LocationCoordinates & { coordinate_system?: LocationCoordinateSystem | null; country?: string | null }>(location: T): Omit<T, 'coordinate_system'> & { coordinate_system?: LocationCoordinateSystem | null } {
  const { latitude: lat, longitude: lon } = location
  // A country explicitly outside mainland China wins over the rough bounding box.
  if (location.country && !['中国', '中国大陆', 'China', 'CN'].includes(location.country.trim())) return location
  if (location.coordinate_system !== 'wgs84' || lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271) return location
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
  return { ...location, latitude: lat + dlat, longitude: lon + dlon, coordinate_system: 'gcj02' }
}
