import Taro from '@tarojs/taro'

/**
 * 将 data URL / 网络图转为 Canvas 2D createImage 可用的本地路径。
 * 与 food_link `resolveCanvasImageSrc` 一致：优先 getImageInfo（小程序对合法域名图会返回本地 path），失败再 downloadFile。
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
      /* fallthrough */
    }
    try {
      const res = await Taro.downloadFile({ url: networkUrl })
      if (res.statusCode === 200 && res.tempFilePath) {
        const info2 = await Taro.getImageInfo({ src: res.tempFilePath })
        return info2.path || res.tempFilePath
      }
    } catch (e) {
      console.warn('[resolveCanvasImageSrc] downloadFile failed', networkUrl, e)
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
