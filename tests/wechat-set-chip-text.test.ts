import { describe, expect, it } from 'vitest'
import { formatSetChipText } from '../apps/wechat/src/training/training-execution/posterSetText'

describe('formatSetChipText', () => {
  it('shows reps only when no load was recorded', () => {
    expect(formatSetChipText({ actual_weight: null, actual_reps: 5 })).toBe('5次')
    expect(formatSetChipText({ actual_reps: 12 })).toBe('12次')
    expect(formatSetChipText({ actual_weight: null, actual_reps: null })).toBe('已完成')
  })

  it('keeps the compact poster form when a load was recorded', () => {
    expect(formatSetChipText({ actual_weight: 20, actual_reps: 8 })).toBe('20kg×8')
    expect(formatSetChipText({ actual_weight: 0, actual_reps: 10 })).toBe('自重×10')
  })

  it('shows seconds for timed sets', () => {
    expect(formatSetChipText({ actual_duration: 30, planned_target_type: 'duration' }, { attrs: ['时长'] })).toMatch(/秒$/)
  })
})
