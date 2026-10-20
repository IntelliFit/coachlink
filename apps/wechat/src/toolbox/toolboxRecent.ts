import Taro from '@tarojs/taro'

// Per-device "最近用过" list for the toolbox home. Convenience only: losing it is harmless.
const STORAGE_KEY = 'toolbox_recent_v1'
const MAX_RECENT = 3

export function readRecentToolKeys(validKeys: string[]): string[] {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY)
    const list = Array.isArray(raw) ? raw : []
    return list.filter((key): key is string => typeof key === 'string' && validKeys.includes(key)).slice(0, MAX_RECENT)
  } catch {
    return []
  }
}

export function rememberToolKey(key: string): string[] {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY)
    const previous = Array.isArray(raw) ? raw.filter((item) => typeof item === 'string' && item !== key) : []
    const next = [key, ...previous].slice(0, MAX_RECENT)
    Taro.setStorageSync(STORAGE_KEY, next)
    return next
  } catch {
    return []
  }
}
