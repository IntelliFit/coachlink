/** Shared by both clients and the API: the optional per-session name of an impromptu workout. */
export const DEFAULT_IMPROMPTU_TITLE = '即兴锻炼'
export const IMPROMPTU_TITLE_MAX_LENGTH = 20

export type ImpromptuTitleResult =
  | { ok: true; title: string | null }
  | { ok: false; message: string }

/** `title: null` means "no custom name": the session shows the default label again. */
export function normalizeImpromptuTitle(raw: unknown): ImpromptuTitleResult {
  if (raw === null || raw === undefined) return { ok: true, title: null }
  if (typeof raw !== 'string') return { ok: false, message: '训练名称格式不正确' }
  const title = raw.replace(/\s+/g, ' ').trim()
  if (!title || title === DEFAULT_IMPROMPTU_TITLE) return { ok: true, title: null }
  if (Array.from(title).length > IMPROMPTU_TITLE_MAX_LENGTH) {
    return { ok: false, message: `训练名称最多${IMPROMPTU_TITLE_MAX_LENGTH}个字` }
  }
  return { ok: true, title }
}

export function resolveImpromptuTitle(title: unknown): string {
  const trimmed = typeof title === 'string' ? title.trim() : ''
  return trimmed || DEFAULT_IMPROMPTU_TITLE
}
