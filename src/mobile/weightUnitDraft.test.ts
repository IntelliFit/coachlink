import { describe, expect, it } from 'vitest'
import { convertDraftWeight, initialWeightDraft, weightSubmission } from '../../apps/mobile/src/screens/training/weightUnitDraft'
import { planActionCoachNote } from '../../apps/mobile/src/screens/training/planActionNote'
import { isLikelyVideoUrl, resolveImageThumbnailUrl, resolveMediaUrl } from '../../apps/mobile/src/mediaUrl'

describe('mobile per-set kg / lbs (same rules as the mini-program)', () => {
  it('prefills recorded sets in the unit the student used', () => {
    expect(initialWeightDraft({ actualWeight: 45.36, weightUnit: 'lbs', weightInput: 100 })).toEqual({ weight: '100', weightUnit: 'lbs' })
    expect(initialWeightDraft({ actualWeight: 60 })).toEqual({ weight: '60', weightUnit: 'kg' })
  })

  it('prefills unrecorded sets from the plan, keeping a lbs plan in lbs', () => {
    expect(initialWeightDraft({ plannedWeight: 20.41, plannedWeightUnit: 'lbs', plannedWeightInput: 45 })).toEqual({ weight: '45', weightUnit: 'lbs' })
    expect(initialWeightDraft({ plannedWeight: '60kg' })).toEqual({ weight: '60', weightUnit: 'kg' })
    expect(initialWeightDraft({ plannedWeight: null })).toEqual({ weight: '', weightUnit: 'kg' })
  })

  it('never turns RM or percentage prescriptions into a kg prefill', () => {
    expect(initialWeightDraft({ plannedWeight: '9RM' })).toEqual({ weight: '', weightUnit: 'kg' })
    expect(initialWeightDraft({ plannedWeight: '75%' })).toEqual({ weight: '', weightUnit: 'kg' })
    expect(initialWeightDraft({ plannedWeight: '60-70kg' })).toEqual({ weight: '60', weightUnit: 'kg' })
    expect(initialWeightDraft({ plannedWeight: 0 })).toEqual({ weight: '0', weightUnit: 'kg' })
  })

  it('converts the typed number when switching units', () => {
    expect(convertDraftWeight('100', 'kg', 'lbs')).toBe('220.5')
    expect(convertDraftWeight('100', 'lbs', 'kg')).toBe('45.4')
    expect(convertDraftWeight('', 'kg', 'lbs')).toBe('')
    expect(convertDraftWeight('60', 'kg', 'kg')).toBe('60')
  })

  it('always submits kg and keeps the typed lbs number', () => {
    expect(weightSubmission('100', 'lbs')).toEqual({ actualWeight: 45.36, weightUnit: 'lbs', weightInput: 100 })
    expect(weightSubmission('60', 'kg')).toEqual({ actualWeight: 60, weightUnit: 'kg', weightInput: 60 })
    expect(weightSubmission('0', 'lbs')).toEqual({ actualWeight: 0 })
    expect(weightSubmission(' ', 'kg')).toEqual({ actualWeight: null })
  })
})

describe('coach note for the action being trained', () => {
  const days = [{ dayIndex: 2, actionSets: [
    { action_id: 'a', params: { note: '下放 3 秒' } },
    { action_id: 'b', note: '膝盖别内扣' },
  ] }]

  it('uses the source action index first, then the action id', () => {
    expect(planActionCoachNote(days, 2, { actionId: 'b', sourceActionIndex: 1 }, 0)).toBe('膝盖别内扣')
    expect(planActionCoachNote(days, 2, { actionId: 'a' }, 0)).toBe('下放 3 秒')
    expect(planActionCoachNote(days, 2, { actionId: 'b' }, 5)).toBe('膝盖别内扣')
  })

  it('prefers a note embedded in the execution and returns empty when there is none', () => {
    expect(planActionCoachNote(days, 2, { actionId: 'a', planNote: ' 慢起 ' }, 0)).toBe('慢起')
    expect(planActionCoachNote(days, 3, { actionId: 'a' }, 0)).toBe('')
    expect(planActionCoachNote(null, 1, { actionId: 'a' }, 0)).toBe('')
  })
})

describe('mobile media urls (same rules as the mini-program)', () => {
  it('completes relative paths and resizes COS images', () => {
    expect(resolveMediaUrl('/uploads/a.jpg', 'https://api.example.com/')).toBe('https://api.example.com/uploads/a.jpg')
    expect(resolveMediaUrl('https://x.com/a.mp4', 'https://api.example.com')).toBe('https://x.com/a.mp4')
    expect(resolveMediaUrl('', 'https://api.example.com')).toBe('')
    expect(resolveImageThumbnailUrl('https://cdn-assets.coachlink.fit/a.png', '', 960)).toBe('https://cdn-assets.coachlink.fit/a.png?imageMogr2/thumbnail/960x/format/jpg/quality/80')
    expect(resolveImageThumbnailUrl('https://other.com/a.png', '')).toBe('https://other.com/a.png')
  })

  it('only treats direct video files as playable', () => {
    expect(isLikelyVideoUrl('https://x.com/demo.mp4?sign=1')).toBe(true)
    expect(isLikelyVideoUrl('https://www.bilibili.com/video/BV1')).toBe(false)
  })
})
