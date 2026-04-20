import Taro from '@tarojs/taro'

/** 全站本地存储命名空间，避免与第三方或历史裸 key 冲突 */
const STORAGE_PREFIX = 'coachlink:v1'

/**
 * 生成带前缀的 storage key（段内勿含 `:` 以外的特殊字符）
 */
export function appStorageKey(...parts: string[]): string {
  return [STORAGE_PREFIX, ...parts].join(':')
}

/**
 * 读取 JSON；异常或空值返回 null
 */
export function appStorageGetJSON<T>(key: string): T | null {
  try {
    const raw = Taro.getStorageSync(key)
    if (raw === '' || raw == null) return null
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as T
      } catch {
        return null
      }
    }
    return raw as T
  } catch (e) {
    console.warn('[appStorage] getJSON', key, e)
    return null
  }
}

/**
 * 写入 JSON（stringify）；失败返回 false（如超出小程序存储上限）
 */
export function appStorageSetJSON(key: string, value: unknown): boolean {
  try {
    Taro.setStorageSync(key, JSON.stringify(value))
    return true
  } catch (e) {
    console.warn('[appStorage] setJSON', key, e)
    return false
  }
}

export function appStorageRemove(key: string): void {
  try {
    Taro.removeStorageSync(key)
  } catch (e) {
    console.warn('[appStorage] remove', key, e)
  }
}
