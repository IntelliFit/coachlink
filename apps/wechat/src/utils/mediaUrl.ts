import { API_BASE_URL } from './request'

export function resolveWeappMediaUrl(raw?: string | null): string {
  const value = String(raw || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  const base = String(API_BASE_URL || '').replace(/\/$/, '')
  const path = value.startsWith('/') ? value : `/${value}`
  return base ? `${base}${path}` : value
}

/** Hosts served from Tencent COS with the image-processing (imageMogr2) service enabled. */
const RESIZABLE_IMAGE_HOSTS = ['cdn-assets.coachlink.fit']

/**
 * Downscaled JPEG of a CDN image for list and card display. Action reference images are
 * ~1.5 MB PNGs; a 480px thumbnail is ~12 KB. URLs on other hosts, non-raster files or URLs
 * that already carry a query string are returned unchanged. Keep the full URL for previewImage.
 */
export function resolveWeappImageThumbnailUrl(raw?: string | null, width = 480): string {
  const url = resolveWeappMediaUrl(raw)
  const match = url.match(/^https:\/\/([^/?#]+)\/[^?#]+\.(png|jpe?g|webp)$/i)
  if (!match || !RESIZABLE_IMAGE_HOSTS.includes(match[1].toLowerCase())) return url
  const safeWidth = Math.max(64, Math.min(1600, Math.round(width)))
  return `${url}?imageMogr2/thumbnail/${safeWidth}x/format/jpg/quality/80`
}

export function isLikelyVideoUrl(raw?: string | null): boolean {
  const value = String(raw || '').trim()
  if (!value) return false
  return /\.(mp4|mov|m4v|webm|m3u8)(\?|#|$)/i.test(value)
}

