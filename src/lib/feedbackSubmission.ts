export type FeedbackCategory = 'bug' | 'suggestion' | 'experience' | 'other'

export type NormalizedFeedbackSubmission = {
  content: string
  relatedQuestion: string
  category: FeedbackCategory
  contact: string
  pagePath: string
  appVersion: string
  clientInfo: Record<string, unknown>
  recentRequests: unknown[]
  imageUrls: string[]
}

const FEEDBACK_CATEGORIES = new Set<FeedbackCategory>(['bug', 'suggestion', 'experience', 'other'])

function text(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeFeedbackSubmission(input: unknown):
  | { ok: true; value: NormalizedFeedbackSubmission }
  | { ok: false; message: string } {
  const body = isPlainObject(input) ? input : {}
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) return { ok: false, message: '反馈内容不能为空' }
  if (content.length > 2000) return { ok: false, message: '反馈内容不能超过2000字' }

  const rawCategory = text(body.category, 32) as FeedbackCategory
  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls
        .map((item) => text(item, 2000))
        .filter((item) => /^https?:\/\//i.test(item))
        .slice(0, 4)
    : []

  return {
    ok: true,
    value: {
      content,
      relatedQuestion: text(body.relatedQuestion, 200),
      category: FEEDBACK_CATEGORIES.has(rawCategory) ? rawCategory : 'other',
      contact: text(body.contact, 200),
      pagePath: text(body.pagePath, 500),
      appVersion: text(body.appVersion, 100),
      clientInfo: isPlainObject(body.clientInfo) ? body.clientInfo : {},
      recentRequests: Array.isArray(body.recentRequests) ? body.recentRequests.slice(0, 20) : [],
      imageUrls,
    },
  }
}
