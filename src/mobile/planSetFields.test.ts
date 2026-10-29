import { describe, expect, it } from 'vitest'
import { findLockedPlanDayViolation } from '@coachlink/core/src/planEditLock'
import {
  ensureSetUids,
  getSetNote,
  getSetReps,
  getSetRestSeconds,
  getSetSets,
  getSetWeight,
  normalizeDaysForSave,
  withFixedLoad,
  withPickedAction,
  withSetCounts,
  withSetNote,
  withoutFixedLoad,
} from '../../apps/mobile/src/screens/plan/model/planSetFields'
import { createActionSet } from '../../apps/mobile/src/screens/plan/model/planEditor'
import { applyStrengthControlValue } from '../../apps/mobile/src/screens/plan/model/planStrength'

describe('mobile plan set fields', () => {
  it('reads top-level values first, like the mini-program coach page', () => {
    const set = { sets: 5, reps: 3, weight: 100, params: { sets: 3, reps: 10, '组数': 2, load: 60 } }
    expect(getSetSets(set)).toBe(5)
    expect(getSetReps(set)).toBe(3)
    expect(getSetWeight(set)).toBe(100)
    expect(getSetSets({ params: { '组数': 4 } })).toBe(4)
  })

  it('writes counts to every alias the execution screen reads', () => {
    const next = withSetCounts({ sets: 5, params: { sets: 5, '组数': 5 } }, { sets: 3, reps: 8, restSeconds: 120 })
    expect(next).toMatchObject({ sets: 3, reps: 8, params: { sets: 3, '组数': 3, reps: 8, '次数': 8, rest_seconds: 120, '休息时间': 120 } })
  })

  it('swaps an exercise on every id and name alias', () => {
    const old = { action_id: 'old', actionId: 'old', action_name: '卧推', set_name: '自定义', setName: '卧推', params: { action_id: 'old', sets: 3 } }
    const next = withPickedAction(old, { id: 'new', name: '深蹲' })
    expect(next).toMatchObject({ action_id: 'new', actionId: 'new', action_name: '深蹲', actionName: '深蹲', setName: '深蹲' })
    expect(next).not.toHaveProperty('set_name')
    expect(next.params).toEqual({ sets: 3 })
  })

  it('drops fixed and server-computed loads when switching to relative intensity', () => {
    const fixed = { weight: 80, params: { load: 80, weight: 80, '重量': 80, loadCalculated: true, intensityConfig: { recommendedLoad: { value: 80, unit: 'kg' } } } }
    const relative = withoutFixedLoad(fixed)
    expect(getSetWeight(relative)).toBeNull()
    const params = applyStrengthControlValue(relative.params || {}, { mode: 'percentage', value: '75' })
    expect(params.intensityConfig).toEqual({ relativeIntensity: { type: 'percentage', value: 75 } })
  })

  it('keeps notes in params.note', () => {
    const next = withSetNote({ note: '旧备注', params: { sets: 3 } }, '控制下放')
    expect(next).toEqual({ params: { sets: 3, note: '控制下放' } })
    expect(getSetNote({ note: '只有顶层' })).toBe('只有顶层')
  })

  it('normalizes days for save and clears items on rest days', () => {
    const strength = withPickedAction(createActionSet('STRENGTH'), { id: 'a1', name: '深蹲' })
    const saved = normalizeDaysForSave([
      { dayIndex: 2, type: 'rest', actionSets: [createActionSet('HABIT')] },
      { dayIndex: 1, type: 'training', actionSets: [strength, createActionSet('CARDIO')] },
    ])
    expect(saved.map((day) => day.dayIndex)).toEqual([1, 2])
    expect(saved[1]).toMatchObject({ type: 'rest', actionSets: [], actionSetsCount: 0 })
    expect(saved[0].actionSetsCount).toBe(2)
    expect(saved[0].actionSets[0]).toMatchObject({ action_id: 'a1', sets: 3, params: { sets: 3, '组数': 3, reps: 10, '次数': 10 } })
    // 非力量项没有动作库条目时，用默认名称（例如「有氧安排」）补齐 action_name，执行端不会显示「未知动作」。
    expect(saved[0].actionSets[1]).toMatchObject({ action_name: '有氧安排', setName: '有氧安排' })
  })

  it('reads and mirrors rest time in the execution screen order', () => {
    expect(getSetRestSeconds({ rest_seconds: 60, params: { rest_seconds: 120, '休息时间': 90 } })).toBe(90)
    expect(getSetRestSeconds({ rest_seconds: 60, params: { rest_seconds: 120 } })).toBe(60)
    const [day] = normalizeDaysForSave([{ dayIndex: 1, type: 'training', actionSets: [{ actionId: 'a1', actionName: '深蹲', params: { rest_seconds: 150 } }] }])
    // 执行端不读 params.rest_seconds，必须写到「休息时间」。
    expect(day.actionSets[0].params).toMatchObject({ rest_seconds: 150, '休息时间': 150 })
  })

  it('clears every legacy fixed-load field and writes fixed loads everywhere', () => {
    const legacy = { params: { '杠铃负重(备选)': 60, intensityConfig: { fixedWeight: 60, relativeIntensity: { type: 'rm', value: 8 } } } }
    const cleared = withoutFixedLoad(legacy)
    expect(getSetWeight(cleared)).toBeNull()
    expect(cleared.params?.intensityConfig).toEqual({ relativeIntensity: { type: 'rm', value: 8 } })
    expect(normalizeDaysForSave([{ dayIndex: 1, type: 'training', actionSets: [{ actionId: 'a1', ...cleared }] }])[0].actionSets[0].params).not.toHaveProperty('load')

    const fixed = withFixedLoad(legacy, 70)
    expect(fixed).toMatchObject({ weight: 70, params: { load: 70, weight: 70, '重量': 70, intensityConfig: { fixedWeight: 70 } } })
    expect(fixed.params).not.toHaveProperty('杠铃负重(备选)')
  })

  it('keeps items on locked rest days and strips editor keys', () => {
    const lockedRest = { dayIndex: 1, type: 'rest' as const, actionSets: [{ _uid: 'k1', itemType: 'HABIT', params: {} }] }
    const saved = normalizeDaysForSave([lockedRest, { dayIndex: 2, type: 'rest', actionSets: [{ _uid: 'k2' }] }], { lockedThroughDayIndex: 1 })
    expect(saved[0].actionSets).toEqual([{ itemType: 'HABIT', params: {} }])
    expect(saved[1].actionSets).toEqual([])
    const training = normalizeDaysForSave([{ dayIndex: 1, type: 'training', actionSets: [{ _uid: 'k3', actionId: 'a1', actionName: '深蹲' }] }])
    expect(training[0].actionSets[0]).not.toHaveProperty('_uid')
  })

  it('assigns unique editor keys without touching existing ones', () => {
    const days = [{ dayIndex: 1, type: 'training' as const, actionSets: [{ _uid: 'same' }, { _uid: 'same' }, {}] }]
    const keyed = ensureSetUids(days)
    const uids = keyed[0].actionSets.map((set) => set._uid)
    expect(uids[0]).toBe('same')
    expect(new Set(uids).size).toBe(3)
    expect(ensureSetUids(keyed)).toBe(keyed)
  })

  it('does not change the structure the plan lock compares', () => {
    const savedDays = [{ dayIndex: 1, type: 'training', actionSets: [{ action_id: 'a1', actionName: '深蹲', params: { sets: 3 } }] }]
    const edited = normalizeDaysForSave([{ dayIndex: 1, type: 'training', actionSets: [withSetCounts(savedDays[0].actionSets[0], { sets: 5 })] }])
    expect(findLockedPlanDayViolation({ savedDays, nextDays: edited, lockedThroughDayIndex: 1 })).toBeNull()
  })
})
