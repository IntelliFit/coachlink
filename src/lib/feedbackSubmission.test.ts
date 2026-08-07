import { describe, expect, it } from 'vitest'
import { normalizeFeedbackSubmission } from './feedbackSubmission'

describe('normalizeFeedbackSubmission', () => {
  it('trims valid feedback and preserves supported metadata', () => {
    const result = normalizeFeedbackSubmission({
      content: '  页面无法打开  ',
      category: 'bug',
      contact: ' user@example.com ',
      imageUrls: ['https://cdn.example.com/a.jpg'],
      clientInfo: { platform: 'android' },
    })
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        content: '页面无法打开',
        category: 'bug',
        contact: 'user@example.com',
        imageUrls: ['https://cdn.example.com/a.jpg'],
        clientInfo: { platform: 'android' },
      }),
    })
  })

  it('rejects empty and overlong content', () => {
    expect(normalizeFeedbackSubmission({ content: '  ' })).toEqual({ ok: false, message: '反馈内容不能为空' })
    expect(normalizeFeedbackSubmission({ content: 'a'.repeat(2001) })).toEqual({ ok: false, message: '反馈内容不能超过2000字' })
  })

  it('falls back to other and removes unsafe image URLs', () => {
    const result = normalizeFeedbackSubmission({ content: '建议', category: 'invalid', imageUrls: ['file:///tmp/a.jpg', 'https://cdn.example.com/a.jpg'] })
    expect(result.ok && result.value.category).toBe('other')
    expect(result.ok && result.value.imageUrls).toEqual(['https://cdn.example.com/a.jpg'])
  })

  it('limits attachments and recent request diagnostics', () => {
    const result = normalizeFeedbackSubmission({
      content: '卡顿',
      imageUrls: Array.from({ length: 8 }, (_, index) => `https://cdn.example.com/${index}.jpg`),
      recentRequests: Array.from({ length: 30 }, (_, index) => ({ index })),
    })
    expect(result.ok && result.value.imageUrls).toHaveLength(4)
    expect(result.ok && result.value.recentRequests).toHaveLength(20)
  })
})
