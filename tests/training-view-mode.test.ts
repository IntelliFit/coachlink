import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TRAINING_VIEW_MODE,
  normalizeTrainingViewMode,
  RPE_QUICK_PICKS,
  toggleQuickRpe
} from '../packages/core/src/trainingViewMode'

describe('normalizeTrainingViewMode', () => {
  it('defaults to list mode for anything unknown or missing', () => {
    expect(DEFAULT_TRAINING_VIEW_MODE).toBe('list')
    expect(normalizeTrainingViewMode(undefined)).toBe('list')
    expect(normalizeTrainingViewMode(null)).toBe('list')
    expect(normalizeTrainingViewMode('')).toBe('list')
    expect(normalizeTrainingViewMode('grid')).toBe('list')
    expect(normalizeTrainingViewMode(1)).toBe('list')
  })

  it('keeps a stored card choice', () => {
    expect(normalizeTrainingViewMode('card')).toBe('card')
    expect(normalizeTrainingViewMode(' card ')).toBe('card')
    expect(normalizeTrainingViewMode('list')).toBe('list')
  })
})

describe('toggleQuickRpe', () => {
  it('offers the common working-set range', () => {
    expect(RPE_QUICK_PICKS).toEqual([6, 7, 8, 9, 10])
  })

  it('selects a value, and tapping the selected value clears it', () => {
    expect(toggleQuickRpe(null, 8)).toBe(8)
    expect(toggleQuickRpe(7, 8)).toBe(8)
    expect(toggleQuickRpe(8, 8)).toBeNull()
  })
})
