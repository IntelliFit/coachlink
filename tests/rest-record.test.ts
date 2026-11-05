import { describe, expect, it } from 'vitest'
import {
  MAX_ACTUAL_REST_SECONDS,
  applyActualRest,
  computeActualRestSeconds,
  formatActionRestSummary,
  formatRestDuration,
  formatSetRestDetail,
  isRestTarget,
  normalizeRestSeconds,
  parseRecordRestInput,
  remapRestTarget
} from '../packages/core/src/restRecord'

const T0 = 1_700_000_000_000

describe('actual rest duration', () => {
  it('counts to the deadline when the countdown runs out, even if the page reports it later', () => {
    // 90s planned + 17 × 15s = 345s; user came back after it expired
    expect(computeActualRestSeconds({ startedAt: T0, deadlineAt: T0 + 345_000, endedAt: T0 + 600_000 })).toBe(345)
  })

  it('counts to the tap when rest is skipped or cut to zero early', () => {
    expect(computeActualRestSeconds({ startedAt: T0, deadlineAt: T0 + 90_000, endedAt: T0 + 42_400 })).toBe(42)
    expect(computeActualRestSeconds({ startedAt: T0, deadlineAt: 0, endedAt: T0 + 30_000 })).toBe(30)
  })

  it('never goes negative and rejects broken clocks', () => {
    expect(computeActualRestSeconds({ startedAt: T0, deadlineAt: T0 + 90_000, endedAt: T0 - 5_000 })).toBe(0)
    expect(computeActualRestSeconds({ startedAt: 0, deadlineAt: T0, endedAt: T0 })).toBeNull()
    expect(computeActualRestSeconds({ startedAt: T0, deadlineAt: 0, endedAt: T0 + (MAX_ACTUAL_REST_SECONDS + 1) * 1000 })).toBeNull()
  })

  it('normalizes stored seconds', () => {
    expect(normalizeRestSeconds('345')).toBe(345)
    expect(normalizeRestSeconds(44.6)).toBe(45)
    expect(normalizeRestSeconds(0)).toBe(0)
    expect(normalizeRestSeconds(-1)).toBeNull()
    expect(normalizeRestSeconds('')).toBeNull()
    expect(normalizeRestSeconds(undefined)).toBeNull()
  })
})

describe('rest target', () => {
  const target = { executionId: 'e1', actionIndex: 2, setIndex: 7, startedAt: T0 }

  it('validates stored targets', () => {
    expect(isRestTarget(target)).toBe(true)
    expect(isRestTarget({ ...target, actionIndex: -1 })).toBe(false)
    expect(isRestTarget({ ...target, executionId: '' })).toBe(false)
    expect(isRestTarget(null)).toBe(false)
  })

  it('follows its action when actions are reordered mid-rest', () => {
    // order[new] = old: action 2 moved to the front
    expect(remapRestTarget(target, [2, 0, 1])).toEqual({ ...target, actionIndex: 0 })
    expect(remapRestTarget(target, [0, 1])).toBeNull()
    expect(remapRestTarget(null, [0])).toBeNull()
  })
})

describe('parseRecordRestInput', () => {
  const body = { executionId: ' e1 ', actionIndex: 0, setIndex: 7, actualRestSeconds: 345, actionKey: 'a1' }

  it('accepts a well-formed body', () => {
    expect(parseRecordRestInput(body)).toEqual({ ...body, executionId: 'e1' })
  })

  it('rejects missing or malformed fields', () => {
    expect(parseRecordRestInput(null)).toBeNull()
    expect(parseRecordRestInput({ ...body, executionId: '' })).toBeNull()
    expect(parseRecordRestInput({ ...body, actionKey: undefined })).toBeNull()
    expect(parseRecordRestInput({ ...body, actionIndex: 1.5 })).toBeNull()
    expect(parseRecordRestInput({ ...body, setIndex: -1 })).toBeNull()
    expect(parseRecordRestInput({ ...body, actualRestSeconds: MAX_ACTUAL_REST_SECONDS + 1 })).toBeNull()
    expect(parseRecordRestInput({ ...body, actualRestSeconds: 'abc' })).toBeNull()
  })
})

describe('applyActualRest', () => {
  const actions = [
    { action_id: 'a', sets: [{ status: 'completed', planned_rest_seconds: 90 }, { status: 'pending', planned_rest_seconds: 90 }] }
  ]

  it('writes the completed set without touching the input', () => {
    const result = applyActualRest(actions, 0, 0, 345)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.actions[0].sets[0]).toEqual({ status: 'completed', planned_rest_seconds: 90, actual_rest_seconds: 345 })
    expect(result.actions[0].sets[1]).toBe(actions[0].sets[1])
    expect(actions[0].sets[0]).not.toHaveProperty('actual_rest_seconds')
    // planned rest stays the plan
    expect(result.actions[0].sets[0].planned_rest_seconds).toBe(90)
  })

  it('refuses pending sets, missing sets and bad values', () => {
    expect(applyActualRest(actions, 0, 1, 60)).toEqual({ ok: false, reason: 'set_not_completed' })
    expect(applyActualRest(actions, 0, 5, 60)).toEqual({ ok: false, reason: 'set_not_found' })
    expect(applyActualRest(actions, 3, 0, 60)).toEqual({ ok: false, reason: 'set_not_found' })
    expect(applyActualRest(actions, 0, 0, 'x')).toEqual({ ok: false, reason: 'invalid_seconds' })
  })
})

describe('rest display', () => {
  it('formats durations', () => {
    expect(formatRestDuration(345)).toBe('5分45秒')
    expect(formatRestDuration(120)).toBe('2分钟')
    expect(formatRestDuration(45)).toBe('45秒')
    expect(formatRestDuration(null)).toBe('')
  })

  it('shows the actual rest in the set record, with the plan when it differs', () => {
    expect(formatSetRestDetail({ planned_rest_seconds: 90, actual_rest_seconds: 345 })).toBe('5分45秒（计划 1分30秒）')
    expect(formatSetRestDetail({ planned_rest_seconds: 90, actual_rest_seconds: 90 })).toBe('1分30秒')
    expect(formatSetRestDetail({ planned_rest_seconds: 90, actual_rest_seconds: 0 })).toBe('未休息（计划 1分30秒）')
    expect(formatSetRestDetail({ actual_rest_seconds: 60 })).toBe('1分钟')
  })

  it('labels the plan when no rest was recorded', () => {
    expect(formatSetRestDetail({ planned_rest_seconds: 90 })).toBe('计划 1分30秒')
    expect(formatSetRestDetail({})).toBe('未设')
    expect(formatSetRestDetail({ planned_rest_seconds: 0 })).toBe('无间歇')
  })

  it('summarizes an action by its recorded rests, falling back to the plan', () => {
    const plan = { planned_rest_seconds: 90 }
    expect(formatActionRestSummary([plan, plan])).toBe('间歇 1分30秒')
    expect(formatActionRestSummary([{ ...plan, actual_rest_seconds: 345 }, plan])).toBe('实际间歇 5分45秒')
    expect(formatActionRestSummary([
      { ...plan, actual_rest_seconds: 90 },
      { ...plan, actual_rest_seconds: 345 }
    ])).toBe('实际间歇 1分30秒–5分45秒')
    expect(formatActionRestSummary([{}])).toBe('')
    expect(formatActionRestSummary(null)).toBe('')
  })
})
