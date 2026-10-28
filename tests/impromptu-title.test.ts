import { describe, expect, it } from 'vitest'
import {
  DEFAULT_IMPROMPTU_TITLE,
  IMPROMPTU_TITLE_MAX_LENGTH,
  normalizeImpromptuTitle,
  resolveImpromptuTitle
} from '../packages/core/src/impromptuTitle'

describe('normalizeImpromptuTitle', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeImpromptuTitle('  胸背日   推  ')).toEqual({ ok: true, title: '胸背日 推' })
  })

  it('treats empty, blank, null and the default label as clearing the custom name', () => {
    expect(normalizeImpromptuTitle('')).toEqual({ ok: true, title: null })
    expect(normalizeImpromptuTitle('   ')).toEqual({ ok: true, title: null })
    expect(normalizeImpromptuTitle(null)).toEqual({ ok: true, title: null })
    expect(normalizeImpromptuTitle(undefined)).toEqual({ ok: true, title: null })
    expect(normalizeImpromptuTitle(DEFAULT_IMPROMPTU_TITLE)).toEqual({ ok: true, title: null })
  })

  it('counts characters, not UTF-16 units, against the limit', () => {
    const atLimit = '练'.repeat(IMPROMPTU_TITLE_MAX_LENGTH)
    expect(normalizeImpromptuTitle(atLimit)).toEqual({ ok: true, title: atLimit })
    expect(normalizeImpromptuTitle('💪'.repeat(IMPROMPTU_TITLE_MAX_LENGTH)).ok).toBe(true)
    const tooLong = normalizeImpromptuTitle('练'.repeat(IMPROMPTU_TITLE_MAX_LENGTH + 1))
    expect(tooLong.ok).toBe(false)
  })

  it('rejects non-string input', () => {
    expect(normalizeImpromptuTitle(123).ok).toBe(false)
    expect(normalizeImpromptuTitle({}).ok).toBe(false)
  })
})

describe('resolveImpromptuTitle', () => {
  it('falls back to the default label when no custom name is set', () => {
    expect(resolveImpromptuTitle(null)).toBe(DEFAULT_IMPROMPTU_TITLE)
    expect(resolveImpromptuTitle('  ')).toBe(DEFAULT_IMPROMPTU_TITLE)
    expect(resolveImpromptuTitle(' 腿日 ')).toBe('腿日')
  })
})
