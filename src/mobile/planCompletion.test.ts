import { describe, expect, it, vi } from 'vitest'

vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }))

import { isPlanReadyToComplete, plansReadyToComplete } from '../../apps/mobile/src/screens/training/planCompletion'
import { emptyTodayTrainingPlanBlock, type TodayTrainingCache } from '../../apps/mobile/src/screens/training/todayTrainingCache'

function block(overrides: Record<string, unknown>) {
  return { ...emptyTodayTrainingPlanBlock(), ...overrides }
}

describe('mobile plan auto-completion', () => {
  it('completes only active plans whose training days are all completed', () => {
    expect(isPlanReadyToComplete(block({ instance: { id: 'p1', status: 'active' }, completedDays: [1, 2, 3], totalTrainingDays: 3 }))).toBe(true)
    expect(isPlanReadyToComplete(block({ instance: { id: 'p1', status: 'active' }, completedDays: [1, 2], totalTrainingDays: 3 }))).toBe(false)
    expect(isPlanReadyToComplete(block({ instance: { id: 'p1', status: 'completed' }, completedDays: [1, 2, 3], totalTrainingDays: 3 }))).toBe(false)
    expect(isPlanReadyToComplete(block({ instance: { id: 'p1', status: 'active' }, completedDays: [], totalTrainingDays: 0 }))).toBe(false)
    expect(isPlanReadyToComplete(null)).toBe(false)
  })

  it('collects coach and self plans once each', () => {
    const done = block({ instance: { id: 'coach-plan', status: 'ACTIVE' }, completedDays: [1], totalTrainingDays: 1 })
    const cache: TodayTrainingCache = {
      v: 1,
      savedAt: 0,
      userId: 'u1',
      coachSubscriptions: [],
      coachPlanDataBySubId: { s1: done, s2: done, s3: block({ instance: { id: 'other', status: 'active' }, completedDays: [], totalTrainingDays: 2 }) },
      activeCoachSubscriptionId: 's1',
      selfPlanData: block({ instance: { id: 'self-plan', status: 'active' }, completedDays: [1, 2], totalTrainingDays: 2 }),
      recentActions: [],
      planMode: 'coach',
      selectedDayIndex: 1,
    }
    expect(plansReadyToComplete(cache).map((instance) => instance.id)).toEqual(['coach-plan', 'self-plan'])
    expect(plansReadyToComplete(null)).toEqual([])
  })
})
