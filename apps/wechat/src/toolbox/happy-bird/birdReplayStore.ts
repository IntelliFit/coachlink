import Taro from '@tarojs/taro'

const REPLAY_KEY_PREFIX = 'happy_bird_latest_replay_v1'
const BEST_KEY_PREFIX = 'happy_bird_best_score_v1'

type CachedReplay = {
  savedAt: number
  tempVideoPath: string
}

function currentUserId() {
  try {
    return String(Taro.getStorageSync('user')?.id || '').trim() || 'guest'
  } catch {
    return 'guest'
  }
}

export function fileExists(filePath: string) {
  return new Promise<boolean>((resolve) => {
    try {
      Taro.getFileSystemManager().access({
        path: filePath,
        success: () => resolve(true),
        fail: () => resolve(false)
      })
    } catch {
      resolve(false)
    }
  })
}

/** 上一局回放存在小程序本地，重新进页面还能看；文件已被系统清理时返回空。 */
export async function readLatestReplayPath() {
  const key = `${REPLAY_KEY_PREFIX}:${currentUserId()}`
  try {
    const cached = Taro.getStorageSync(key) as CachedReplay | ''
    if (!cached || !cached.tempVideoPath) return ''
    if (await fileExists(cached.tempVideoPath)) return cached.tempVideoPath
    Taro.removeStorageSync(key)
    return ''
  } catch {
    return ''
  }
}

/** 把临时视频转存到本地并替换上一局；转存失败时退回临时路径，当次仍可保存到相册。 */
export function keepReplay(tempVideoPath: string) {
  return new Promise<string>((resolve) => {
    Taro.saveFile({
      tempFilePath: tempVideoPath,
      success: (result) => {
        const key = `${REPLAY_KEY_PREFIX}:${currentUserId()}`
        try {
          const previous = Taro.getStorageSync(key) as CachedReplay | ''
          Taro.setStorageSync(key, { savedAt: Date.now(), tempVideoPath: result.savedFilePath } satisfies CachedReplay)
          if (previous && previous.tempVideoPath && previous.tempVideoPath !== result.savedFilePath) {
            void Taro.removeSavedFile({ filePath: previous.tempVideoPath }).catch(() => undefined)
          }
        } catch (error) {
          console.warn('快乐小鸟回放索引保存失败:', error)
        }
        resolve(result.savedFilePath)
      },
      fail: (error) => {
        console.warn('快乐小鸟回放转存失败:', error)
        resolve(tempVideoPath)
      }
    })
  })
}

/** 没联网或在线榜不可用时，历史最佳也不能丢。 */
export function readLocalBest() {
  try {
    return Number(Taro.getStorageSync(`${BEST_KEY_PREFIX}:${currentUserId()}`)) || 0
  } catch {
    return 0
  }
}

export function writeLocalBest(score: number) {
  try {
    Taro.setStorageSync(`${BEST_KEY_PREFIX}:${currentUserId()}`, score)
  } catch {
    // 只是方便下次显示，写失败不影响玩
  }
}
