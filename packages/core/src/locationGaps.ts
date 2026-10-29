import { resolveLocationEquipment, type LocationEquipmentInput } from './locationEquipment'

export type LocationGap = 'photo' | 'equipment' | 'position' | 'description'

export const LOCATION_GAP_LABELS: Record<LocationGap, string> = {
  photo: '缺照片',
  equipment: '器材待确认',
  position: '缺定位',
  description: '缺描述',
}

type LocationGapInput = LocationEquipmentInput & {
  image_url?: string | null
  image_urls?: string[] | null
  latitude?: number | null
  longitude?: number | null
  description?: string | null
}

/** What a contributor can still add so others can find and trust the spot, most useful first. */
export function getLocationGaps(location: LocationGapInput): LocationGap[] {
  const hasPhoto = (location.image_urls || []).some(url => String(url || '').trim()) || Boolean(String(location.image_url || '').trim())
  const hasPosition = typeof location.latitude === 'number' && typeof location.longitude === 'number'
  return [
    hasPhoto ? null : 'photo',
    resolveLocationEquipment(location).equipment_source === 'confirmed' ? null : 'equipment',
    hasPosition ? null : 'position',
    String(location.description || '').trim() ? null : 'description',
  ].filter((gap): gap is LocationGap => gap !== null)
}
