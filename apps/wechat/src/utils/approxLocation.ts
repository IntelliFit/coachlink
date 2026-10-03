import Taro from '@tarojs/taro'
import { isValidLocationCoordinates } from '@coachlink/core'

type Position = { latitude: number; longitude: number }
type FuzzyApi = (options: { type: string; success: (position: Position) => void; fail: (error: unknown) => void }) => void

/** Use the declared fuzzy API; never silently request precise getLocation. */
export async function getApproxUserLocation(): Promise<Position> {
  const native = (globalThis as typeof globalThis & { wx?: { getFuzzyLocation?: FuzzyApi } }).wx
  const taroFuzzy = (Taro as typeof Taro & { getFuzzyLocation?: (options: { type: string }) => Promise<Position> }).getFuzzyLocation
  const position = typeof native?.getFuzzyLocation === 'function'
    ? await new Promise<Position>((resolve, reject) => native.getFuzzyLocation!({ type: 'gcj02', success: resolve, fail: reject }))
    : typeof taroFuzzy === 'function' ? await taroFuzzy({ type: 'gcj02' }) : null
  if (!position || !isValidLocationCoordinates(position.latitude, position.longitude)) throw new Error('附近定位不可用，可直接搜索城市或地址')
  return { latitude: position.latitude, longitude: position.longitude }
}
