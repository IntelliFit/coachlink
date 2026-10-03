import { isValidLocationCoordinates, type LocationCoordinates } from './locationCoordinates'
import { getLocationCountry } from './locationCountry'

export type LocationMapView = LocationCoordinates & { scale: number }
type Pin = LocationCoordinates & { country?: string | null; province?: string | null }
export const DEFAULT_LOCATION_MAP_VIEW: LocationMapView = { latitude: 35, longitude: 105, scale: 4 }

/** Fit actual points, including groups crossing the date line. */
export function fitLocationMapPoints(points: LocationCoordinates[]): LocationMapView {
  const valid = points.filter(p => isValidLocationCoordinates(p.latitude, p.longitude))
  if (!valid.length) return DEFAULT_LOCATION_MAP_VIEW
  if (valid.length === 1) return { ...valid[0], scale: 14 }
  const longitudes = valid.map(p => (p.longitude + 360) % 360).sort((a, b) => a - b)
  let gap = -1, start = 0
  longitudes.forEach((value, i) => {
    const next = longitudes[(i + 1) % longitudes.length] + (i === longitudes.length - 1 ? 360 : 0)
    if (next - value > gap) { gap = next - value; start = next % 360 }
  })
  const span = 360 - gap
  const longitude = ((start + span / 2 + 180) % 360) - 180
  const ys = valid.map(p => Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, p.latitude)) * Math.PI / 360)))
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const latitude = (2 * Math.atan(Math.exp((minY + maxY) / 2)) - Math.PI / 2) * 180 / Math.PI
  const fraction = Math.max(span / 360, (maxY - minY) / (2 * Math.PI), 0.00002)
  return { latitude, longitude, scale: Math.max(3, Math.min(14, Math.floor(Math.log2(280 / (256 * fraction))))) }
}

export function getInitialLocationMapView(pins: Pin[], userLocation?: LocationCoordinates | null): LocationMapView {
  if (userLocation && isValidLocationCoordinates(userLocation.latitude, userLocation.longitude)) return { ...userLocation, scale: 13 }
  const groups = new Map<string, Pin[]>()
  pins.filter(p => isValidLocationCoordinates(p.latitude, p.longitude)).forEach(p => {
    // Unclassified points are grouped geographically, so distant continents do not
    // produce an empty midpoint when legacy metadata is incomplete.
    const key = getLocationCountry(p) || `${Math.floor(p.latitude / 20)}:${Math.floor(p.longitude / 30)}`
    groups.set(key, [...(groups.get(key) || []), p])
  })
  const largest = [...groups.values()].sort((a, b) => b.length - a.length)[0]
  return largest ? fitLocationMapPoints(largest) : DEFAULT_LOCATION_MAP_VIEW
}

/** Only a real user gesture can synchronize the map's controlled zoom. */
export function getGestureMapScale(event: any): number | null {
  const detail = event?.detail || event
  if ((detail?.type || event?.type) !== 'end' || !['gesture', 'drag', 'scale'].includes(detail?.causedBy || event?.causedBy)) return null
  const value = detail?.scale
  return typeof value === 'number' && Number.isFinite(value) && value >= 3 && value <= 20 ? value : null
}
