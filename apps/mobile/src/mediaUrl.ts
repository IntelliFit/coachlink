/**
 * 媒体地址规则，与小程序 utils/mediaUrl.ts 一致：相对路径补全为 API 域名，
 * COS 图片可加缩略参数，视频按扩展名判断能否直接播放。
 * 不依赖 config，方便单测；调用方传入 API_BASE_URL。
 */

export function resolveMediaUrl(raw: string | null | undefined, baseUrl: string): string {
  const value = String(raw || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  const base = String(baseUrl || '').replace(/\/$/, '')
  const path = value.startsWith('/') ? value : `/${value}`
  return base ? `${base}${path}` : value
}

/** Hosts served from Tencent COS with the image-processing (imageMogr2) service enabled. */
const RESIZABLE_IMAGE_HOSTS = ['cdn-assets.coachlink.fit']

export function resolveImageThumbnailUrl(raw: string | null | undefined, baseUrl: string, width = 480): string {
  const url = resolveMediaUrl(raw, baseUrl)
  const match = url.match(/^https:\/\/([^/?#]+)\/[^?#]+\.(png|jpe?g|webp)$/i)
  if (!match || !RESIZABLE_IMAGE_HOSTS.includes(match[1].toLowerCase())) return url
  const safeWidth = Math.max(64, Math.min(1600, Math.round(width)))
  return `${url}?imageMogr2/thumbnail/${safeWidth}x/format/jpg/quality/80`
}

export function isLikelyVideoUrl(raw: string | null | undefined): boolean {
  const value = String(raw || '').trim()
  if (!value) return false
  return /\.(mp4|mov|m4v|webm|m3u8)(\?|#|$)/i.test(value)
}
