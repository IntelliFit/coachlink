import Taro from '@tarojs/taro'

const PRESERVED_STORAGE_KEYS = new Set([
  'token',
  'user',
  'app-theme-mode'
])

/**
 * 清理可再生的本地数据，同时保留登录态和主题偏好。
 * 训练快照、草稿、计时器及旧版缓存均通过遍历 storage key 一并清除。
 */
export function clearLocalCache() {
  const { keys = [] } = Taro.getStorageInfoSync()
  let clearedCount = 0

  keys.forEach((key) => {
    if (PRESERVED_STORAGE_KEYS.has(key)) return

    Taro.removeStorageSync(key)
    clearedCount += 1
  })

  return { clearedCount }
}
