import { describe, expect, it } from 'vitest'
import { formatRestMinutes, restMinutesToSeconds, restSecondsToMinutes } from '../packages/core/src/restDisplay'

describe('rest time display (stored in seconds, shown in minutes)', () => {
  it('converts seconds to minutes with at most two decimals', () => {
    expect(restSecondsToMinutes(90)).toBe(1.5)
    expect(restSecondsToMinutes(120)).toBe(2)
    expect(restSecondsToMinutes(45)).toBe(0.75)
    expect(restSecondsToMinutes(100)).toBe(1.67)
    expect(restSecondsToMinutes('180')).toBe(3)
    expect(restSecondsToMinutes(null)).toBeNull()
    expect(restSecondsToMinutes('abc')).toBeNull()
    expect(restSecondsToMinutes(-1)).toBeNull()
  })

  it('converts minutes back to whole seconds', () => {
    expect(restMinutesToSeconds(1.5)).toBe(90)
    expect(restMinutesToSeconds(0.75)).toBe(45)
    expect(restMinutesToSeconds('2')).toBe(120)
    expect(restMinutesToSeconds('')).toBeNull()
    // 显示值再换回来不漂移
    expect(restMinutesToSeconds(restSecondsToMinutes(100))).toBe(100)
  })

  it('formats for display and hides empty values', () => {
    expect(formatRestMinutes(90)).toBe('1.5分钟')
    expect(formatRestMinutes(60)).toBe('1分钟')
    expect(formatRestMinutes(0)).toBe('')
    expect(formatRestMinutes(undefined)).toBe('')
  })
})
