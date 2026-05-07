import Taro from '@tarojs/taro'

/**
 * 将 data URL / 网络图转为 Canvas 2D createImage 可用的本地路径。
 * 优先 getImageInfo → downloadFile → 最终 fallback 用 Taro.request（可带 Authorization）获取并写入本地。
 */
export async function resolveCanvasImageSrc(src: string): Promise<string> {
  const raw = (src || '').trim()
  if (!raw) throw new Error('empty image src')

  if (/^data:image\//i.test(raw)) {
    const compact = raw.replace(/\s/g, '')
    const m = /^data:image\/[^;]+;base64,(.+)$/i.exec(compact)
    if (!m) return raw
    const userDataPath = (Taro as unknown as { env?: { USER_DATA_PATH?: string } }).env?.USER_DATA_PATH
    if (!userDataPath) return raw
    const path = `${userDataPath}/cv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.jpg`
    try {
      await new Promise<void>((resolve, reject) => {
        Taro.getFileSystemManager().writeFile({
          filePath: path,
          data: m[1],
          encoding: 'base64',
          success: () => resolve(),
          fail: reject
        })
      })
      return path
    } catch (e) {
      console.warn('[resolveCanvasImageSrc] data URI writeFile failed', e)
      return raw
    }
  }

  const networkUrl = raw.startsWith('//') ? `https:${raw}` : raw

  if (/^https?:\/\//.test(networkUrl)) {
    try {
      const info = await Taro.getImageInfo({ src: networkUrl })
      if (info.path) return info.path
    } catch {
      /* getImageInfo 失败继续尝试 downloadFile */
    }
    try {
      const res = await Taro.downloadFile({ url: networkUrl })
      if (res.statusCode === 200 && res.tempFilePath) {
        return res.tempFilePath
      }
      console.warn('[resolveCanvasImageSrc] downloadFile bad status', networkUrl, res.statusCode)
    } catch (e) {
      console.warn('[resolveCanvasImageSrc] downloadFile failed', networkUrl, e)
    }

    /* 最终 fallback：Taro.request 可带 Authorization header，绕过 downloadFile 限制 */
    try {
      const token = Taro.getStorageSync('token') || ''
      const requestRes = await Taro.request({
        url: networkUrl,
        method: 'GET',
        responseType: 'arraybuffer',
        header: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (requestRes.statusCode === 200 && requestRes.data) {
        const fs = Taro.getFileSystemManager()
        const userDataPath = (Taro as any).env?.USER_DATA_PATH
        if (userDataPath) {
          const ext = networkUrl.split('.').pop()?.split('?')[0] || 'png'
          const tmpPath = `${userDataPath}/cv_fb_${Date.now()}.${ext}`
          fs.writeFileSync(tmpPath, requestRes.data as ArrayBuffer, 'binary')
          return tmpPath
        }
      }
      console.warn('[resolveCanvasImageSrc] request fallback bad status', networkUrl, requestRes.statusCode)
    } catch (e) {
      console.warn('[resolveCanvasImageSrc] request fallback failed', networkUrl, e)
    }

    throw new Error(`cannot resolve image: ${networkUrl}`)
  }

  try {
    const info = await Taro.getImageInfo({ src: raw })
    if (info.path) return info.path
  } catch {
    /* 本地路径或包内资源 */
  }
  return raw
}
