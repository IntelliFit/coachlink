import { API_BASE_URL } from './request'

export function resolveWeappMediaUrl(raw?: string | null): string {
  const value = String(raw || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  const base = String(API_BASE_URL || '').replace(/\/$/, '')
  const path = value.startsWith('/') ? value : `/${value}`
  return base ? `${base}${path}` : value
}

export function isLikelyVideoUrl(raw?: string | null): boolean {
  const value = String(raw || '').trim()
  if (!value) return false
  return /\.(mp4|mov|m4v|webm|m3u8)(\?|#|$)/i.test(value)
}

