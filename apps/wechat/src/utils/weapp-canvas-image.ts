import Taro from '@tarojs/taro'

const DATA_IMAGE_RE = /^data:image\/([^;,]+)((?:;[^,]*)?),([\s\S]*)$/i

function hashText(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function extensionForImageSubtype(subtype: string) {
  const normalized = subtype.toLowerCase()
  if (normalized === 'svg+xml') return 'svg'
  if (normalized === 'jpeg' || normalized === 'pjpeg') return 'jpg'
  return normalized.replace(/[^a-z0-9]/g, '') || 'img'
}

async function persistDataImage(raw: string): Promise<string> {
  const match = DATA_IMAGE_RE.exec(raw)
  if (!match) return raw

  const userDataPath = String(Taro.env?.USER_DATA_PATH || '').replace(/\/$/, '')
  if (!userDataPath) return raw

  const [, subtype, parameters, payload] = match
  const isBase64 = /;base64(?:;|$)/i.test(parameters)
  const extension = extensionForImageSubtype(subtype)
  const filePath = `${userDataPath}/coachlink-canvas-${hashText(raw)}.${extension}`
  const fileSystem = Taro.getFileSystemManager()

  try {
    await new Promise<void>((resolve, reject) => {
      fileSystem.writeFile({
        filePath,
        data: isBase64 ? payload.replace(/\s/g, '') : decodeURIComponent(payload),
        encoding: isBase64 ? 'base64' : 'utf8',
        success: () => resolve(),
        fail: reject
      })
    })
    return filePath
  } catch (error) {
    console.warn('[resolveCanvasImageSrc] data URI writeFile failed', error)
    return raw
  }
}

/**
 * 将 data URL / 网络图转为 Canvas 2D createImage 可用的本地路径。
 * 优先 getImageInfo → downloadFile → 最终 fallback 用 Taro.request（可带 Authorization）获取并写入本地。
 */
export async function resolveCanvasImageSrc(src: string): Promise<string> {
  const raw = (src || '').trim()
  if (!raw) throw new Error('empty image src')

  if (/^data:image\//i.test(raw)) {
    return persistDataImage(raw)
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
          // 只从路径最后一段取扩展名：接口地址（如 /api/.../boji-challenge?id=）没有扩展名，
          // 旧写法会把域名后缀连同路径当成扩展名，写入带斜杠的路径而失败
          const lastSegment = networkUrl.split(/[?#]/)[0].split('/').pop() || ''
          const ext = /\.([a-z0-9]{2,5})$/i.exec(lastSegment)?.[1] || 'png'
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
