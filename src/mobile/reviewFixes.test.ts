import { describe, expect, it } from 'vitest'
import { mergeQuestionnaireAnswers } from '../../packages/core/src/questionnaireMerge'
import {
  canReleaseMotionJob,
  isMotionJobPaymentLocked,
  motionRestorePlan,
  shouldRememberMotionJob,
} from '../../apps/mobile/src/screens/toolbox/motionEffectsModel'
import {
  consumeLocationsChanged,
  locationDraftSnapshot,
  markLocationsChanged,
  EMPTY_LOCATION_FORM,
} from '../../apps/mobile/src/screens/streetlifting/locationModel'
import { formatCalcDate } from '../../apps/mobile/src/screens/streetlifting/calculatorSummary'
import { systemMapCoordinates } from '../../apps/mobile/src/screens/streetlifting/locationModel'

describe('questionnaire answers stay on the right question', () => {
  it('matches a 1RM answer without an id to the current RM question, not as a trailing duplicate', () => {
    const merged = mergeQuestionnaireAnswers(
      [{ id: 'rm-new', type: 'rm', userInputs: { 深蹲: '', 卧推: '' } }],
      [{ type: 'rm', userInputs: { 深蹲: 120 } }],
    )
    expect(merged).toHaveLength(1)
    expect(merged[0].userInputs).toEqual({ 深蹲: 120, 卧推: '' })
  })

  it('matches a 1RM answer after the coach re-created the question with a new id', () => {
    const merged = mergeQuestionnaireAnswers(
      [{ id: 'rm-new', type: 'rm', userInputs: { 深蹲: '' } }],
      [{ id: 'rm-old', type: 'rm', userInputs: { 深蹲: 100 } }],
    )
    expect(merged).toHaveLength(1)
    expect(merged[0].userInputs).toEqual({ 深蹲: 100 })
  })

  it('does not move an answer onto a different question when both have ids', () => {
    const merged = mergeQuestionnaireAnswers(
      [{ id: 'goal', type: 'text', question: '目标' }],
      [{ id: 'injury', type: 'text', question: '伤病史', userSelection: '膝盖' }],
    )
    expect(merged[0].userSelection).toBeUndefined()
    expect(merged[1].userSelection).toBe('膝盖')
  })

  it('falls back by order for legacy answers without ids, after exact matches took theirs', () => {
    const merged = mergeQuestionnaireAnswers(
      [{ id: 'a', type: 'text', question: '新题干' }, { id: 'b', type: 'text', question: '原题' }],
      [{ type: 'text', question: '原题', userSelection: '精确' }, { type: 'text', question: '旧题干', userSelection: '兜底' }],
    )
    expect(merged.map((item) => item.userSelection)).toEqual(['兜底', '精确'])
  })

  it('matches option questions by their option list when the wording changed', () => {
    const merged = mergeQuestionnaireAnswers(
      [{ id: 'new', type: 'option', question: '新', options: ['A', 'B'] }],
      [{ id: 'old', type: 'option', question: '旧', options: ['A', 'B'], userSelection: 1 }],
    )
    expect(merged).toHaveLength(1)
    expect(merged[0].userSelection).toBe(1)
  })
})

describe('motion effect job restore never loses a payment', () => {
  it('resumes jobs that are running or finished', () => {
    expect(motionRestorePlan({ status: 'queued' }, true)).toBe('poll')
    expect(motionRestorePlan({ status: 'processing' }, true)).toBe('poll')
    expect(motionRestorePlan({ status: 'done', canDownload: true }, true)).toBe('done')
    expect(motionRestorePlan({ status: 'done', canDownload: false }, true)).toBe('forget')
    expect(motionRestorePlan({ status: 'expired', paymentStatus: 'paid' }, true)).toBe('forget')
  })

  it('confirms payment when the app died during checkout', () => {
    expect(motionRestorePlan({ status: 'awaiting_payment', paymentStatus: 'pending' }, true)).toBe('confirmPayment')
    expect(motionRestorePlan({ status: 'awaiting_upload', paymentStatus: 'paid' }, true)).toBe('confirmPayment')
    // 超时释放之后才付款成功
    expect(motionRestorePlan({ status: 'failed', paymentStatus: 'pending' }, true)).toBe('confirmPayment')
  })

  it('offers a free retry for a paid job that failed, and forgets an unpaid one', () => {
    expect(motionRestorePlan({ status: 'failed', paymentStatus: 'paid' }, true)).toBe('retry')
    expect(motionRestorePlan({ status: 'failed', paymentStatus: 'unpaid' }, true)).toBe('forget')
    expect(motionRestorePlan({ status: 'failed', paymentStatus: 'free' }, true)).toBe('forget')
  })

  it('resumes an uploaded unpaid job and releases one whose upload never finished', () => {
    expect(motionRestorePlan({ status: 'awaiting_upload', paymentStatus: 'unpaid' }, true)).toBe('resume')
    expect(motionRestorePlan({ status: 'awaiting_upload', paymentStatus: 'unpaid' }, false)).toBe('release')
  })

  it('remembers every job that could still hold money', () => {
    expect(shouldRememberMotionJob({ status: 'awaiting_upload' })).toBe(true)
    expect(shouldRememberMotionJob({ status: 'awaiting_payment', paymentStatus: 'pending' })).toBe(true)
    expect(shouldRememberMotionJob({ status: 'failed', paymentStatus: 'paid' })).toBe(true)
    expect(shouldRememberMotionJob({ status: 'failed', paymentStatus: 'unpaid' })).toBe(false)
    expect(shouldRememberMotionJob({ status: 'expired' })).toBe(false)
  })

  it('never releases a job once payment started', () => {
    expect(isMotionJobPaymentLocked({ status: 'awaiting_payment', paymentStatus: 'pending' })).toBe(true)
    expect(isMotionJobPaymentLocked({ status: 'awaiting_upload', paymentStatus: 'paid' })).toBe(true)
    expect(isMotionJobPaymentLocked({ status: 'failed', paymentStatus: 'paid' })).toBe(false)
    expect(canReleaseMotionJob({ status: 'awaiting_upload', paymentStatus: 'unpaid' })).toBe(true)
    expect(canReleaseMotionJob({ status: 'awaiting_payment', paymentStatus: 'pending' })).toBe(false)
    expect(canReleaseMotionJob({ status: 'queued' })).toBe(false)
    expect(canReleaseMotionJob(null)).toBe(false)
  })
})

describe('streetlifting location helpers', () => {
  it('opens tagged GPS points in the coordinates Chinese map apps use', () => {
    const gps = systemMapCoordinates({ latitude: 39.9, longitude: 116.4, coordinate_system: 'wgs84' })
    expect(gps.latitude).not.toBe(39.9)
    expect(Math.abs(gps.latitude - 39.9)).toBeLessThan(0.01)
    expect(systemMapCoordinates({ latitude: 39.9, longitude: 116.4, coordinate_system: 'gcj02' })).toEqual({ latitude: 39.9, longitude: 116.4 })
    expect(systemMapCoordinates({ latitude: 39.9, longitude: 116.4 })).toEqual({ latitude: 39.9, longitude: 116.4 })
  })

  it('leaves points outside China untouched', () => {
    expect(systemMapCoordinates({ latitude: 35.68, longitude: 139.76, coordinate_system: 'wgs84', country: '日本' })).toEqual({ latitude: 35.68, longitude: 139.76 })
  })

  it('treats an unchanged form as clean even when equipment is still auto-inferred', () => {
    const base = locationDraftSnapshot(EMPTY_LOCATION_FORM, [], false, [])
    expect(locationDraftSnapshot(EMPTY_LOCATION_FORM, [], false, ['horizontal_bar' as any])).toBe(base)
    expect(locationDraftSnapshot({ ...EMPTY_LOCATION_FORM, name: '公园' }, [], false, [])).not.toBe(base)
    expect(locationDraftSnapshot(EMPTY_LOCATION_FORM, ['a.png'], false, [])).not.toBe(base)
    expect(locationDraftSnapshot(EMPTY_LOCATION_FORM, [], true, ['horizontal_bar' as any])).not.toBe(base)
  })

  it('consumes the changed flag once', () => {
    expect(consumeLocationsChanged()).toBe(false)
    markLocationsChanged()
    expect(consumeLocationsChanged()).toBe(true)
    expect(consumeLocationsChanged()).toBe(false)
  })

  it('formats calculator dates in Beijing time', () => {
    expect(formatCalcDate('2026-10-30T00:05:00Z')).toBe('10.30 08:05')
    expect(formatCalcDate('2026-10-30T16:30:00Z')).toBe('10.31 00:30')
  })
})
