import { describe, expect, it } from 'vitest'
import {
  buildPlanMonthGrid,
  describePlanMonthCell,
  formatPlanDayDateLabel,
  getUnlockedPlanWeek,
  nextAccessibleDayIndex,
  planTrainingProgress,
  shiftPlanMonth,
} from '../../packages/core/src/planWeekStrip'
import { getBeijingDateFromParts } from '../../packages/core/src/beijingTime'
import { buildTodaySchedule, strengthDaySummary } from '../../apps/mobile/src/screens/training/todaySchedule'
import { graceRenewalNotice } from '../../apps/mobile/src/screens/training/todayNotices'
import { findQuickStartTemplate, matchesQuickStart } from '../../apps/mobile/src/screens/training/quickStart'

const days = [
  { dayIndex: 1, type: 'training', actionSets: [{ action_id: 'a', params: { 组数: 3 } }, { action_id: 'b', params: { sets: 2 } }] },
  { dayIndex: 2, type: 'rest', actionSets: [] },
  { dayIndex: 3, type: 'training', actionSets: [{ action_id: 'a', params: { 组数: 4 } }, { action_id: 'diet', itemType: 'DIET' }] },
]

function block(overrides: Record<string, any> = {}) {
  return {
    instance: { id: 'p1', start_date: '2026-10-25', training_days: days },
    actions: {},
    recommendedDayIndex: 3,
    todayCompleted: false,
    completionDates: { 1: '2026-10-25T10:00:00+08:00' },
    executionsByDayIndex: { 1: { status: 'completed', completed_at: '2026-10-25T10:00:00+08:00' } },
    missingDays: [],
    ...overrides,
  } as any
}

describe('today schedule (shared with the mini-program)', () => {
  it('maps plan days onto Beijing dates and builds a Sunday-first week', () => {
    const schedule = buildTodaySchedule({ block: block(), planMode: 'self', selectedDayIndex: 3, now: new Date('2026-10-27T09:00:00+08:00') })
    expect(schedule.weekCells.map((cell) => cell.dayNum)).toEqual([25, 26, 27, 28, 29, 30, 31])
    expect(schedule.weekCells[0]).toMatchObject({ weekdayLabel: '日', planDayIndex: 1, status: 'completed' })
    expect(schedule.weekCells[2]).toMatchObject({ planDayIndex: 3, status: 'pending', isToday: true })
    expect(formatPlanDayDateLabel(schedule.selectedDate)).toBe('10月27日 星期二')
  })

  it('anchors a coach plan without start_date to its assignment day', () => {
    const schedule = buildTodaySchedule({
      block: block({ instance: { id: 'p2', created_at: '2026-10-20T08:00:00+08:00', training_days: days }, recommendedDayIndex: 1, completionDates: {}, executionsByDayIndex: {} }),
      planMode: 'coach',
      subscription: { start_date: '2026-01-01' },
      selectedDayIndex: 1,
      now: new Date('2026-10-20T09:00:00+08:00'),
    })
    expect(formatPlanDayDateLabel(schedule.selectedDate)).toBe('10月20日 星期二')
  })

  it('postpones an unfinished day to today instead of leaving it in the past', () => {
    const schedule = buildTodaySchedule({
      block: block({ instance: { id: 'p2', created_at: '2026-10-20T08:00:00+08:00', training_days: days }, recommendedDayIndex: 1, completionDates: {}, executionsByDayIndex: {} }),
      planMode: 'coach',
      selectedDayIndex: 1,
      now: new Date('2026-10-29T09:00:00+08:00'),
    })
    expect(formatPlanDayDateLabel(schedule.selectedDate)).toBe('10月29日 星期四')
  })

  it('describes month cells and cycles through several days on one date', () => {
    const schedule = buildTodaySchedule({ block: block(), planMode: 'self', selectedDayIndex: 3, now: new Date('2026-10-27T09:00:00+08:00') })
    const cell = describePlanMonthCell({ date: getBeijingDateFromParts(2026, 10, 25), scheduleModel: schedule.scheduleModel, trainingDays: schedule.trainingDays,
      executionsByDayIndex: schedule.executionsByDayIndex, completionDates: schedule.completionDates, startExecutionDay: 1, unlockedWeek: schedule.unlockedWeek, selectedDayIndex: 3,
      today: new Date('2026-10-27T09:00:00+08:00') })
    expect(cell).toMatchObject({ dayNum: 25, dayIndexes: [1], status: 'completed', dayLabel: 'D1', typeLabel: '✓', isSelected: false })
    expect(nextAccessibleDayIndex([4, 5], 4)).toBe(5)
    expect(nextAccessibleDayIndex([4, 5], 9)).toBe(4)
    expect(nextAccessibleDayIndex([], 1)).toBeNull()
  })

  it('builds a Monday-first month grid and wraps months', () => {
    const grid = buildPlanMonthGrid(2026, 10)
    expect(grid.length % 7).toBe(0)
    expect(grid.slice(0, 3)).toEqual([null, null, null]) // 2026-10-01 is a Thursday
    expect(shiftPlanMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(shiftPlanMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(getUnlockedPlanWeek(1, 9)).toBe(3)
  })

  it('counts plan progress on training days only', () => {
    expect(planTrainingProgress(days, { 1: { status: 'completed' } }, {})).toEqual({ done: 1, total: 2, percent: 50 })
  })

  it('summarises the strength part of a day from the plan or the execution', () => {
    expect(strengthDaySummary(days[2], null)).toEqual({ actionCount: 1, totalSets: 4, completedSets: 0 })
    expect(strengthDaySummary(days[0], { action_executions: [
      { item_type: 'STRENGTH', sets: [{ status: 'completed' }, { status: 'pending' }] },
      { item_type: 'DIET', sets: [{ status: 'completed' }] },
    ] })).toEqual({ actionCount: 1, totalSets: 2, completedSets: 1 })
  })
})

describe('grace-period renewal notice', () => {
  const now = new Date('2026-10-29T12:00:00+08:00').getTime()
  const grace = { lifecycle_status: 'expired_grace', end_date: '2026-10-27', grace_days_left: 5, grace_deadline_at: '2026-11-03T00:00:00+08:00', coach_id: 'c1' }

  it('shows only when days and credits are used up', () => {
    expect(graceRenewalNotice(grace, now)).toEqual({ daysLeft: 5, deadlineLabel: '11/3', coachId: 'c1' })
    expect(graceRenewalNotice({ ...grace, entitlement_remaining_credits: 2 }, now)).toBeNull()
    expect(graceRenewalNotice({ ...grace, end_date: '2026-11-10' }, now)).toBeNull()
    expect(graceRenewalNotice({ ...grace, lifecycle_status: 'active' }, now)).toBeNull()
    expect(graceRenewalNotice(null, now)).toBeNull()
  })
})

describe('quick start templates', () => {
  it('filters strength actions by body part and street workout separately', () => {
    const push = findQuickStartTemplate('push')
    const street = findQuickStartTemplate('street')
    expect(matchesQuickStart({ name: '杠铃卧推', positions: ['胸部'] }, push)).toBe(true)
    expect(matchesQuickStart({ name: '杠铃划船', positions: ['背部'] }, push)).toBe(false)
    expect(matchesQuickStart({ name: '双杠臂屈伸', category: '街头健身·推' }, push)).toBe(false)
    expect(matchesQuickStart({ name: '双杠臂屈伸', category: '街头健身·推' }, street)).toBe(true)
    expect(matchesQuickStart({ name: '慢跑', type: 'CARDIO' }, street)).toBe(false)
    expect(matchesQuickStart({ name: '任何动作' }, null)).toBe(true)
    expect(findQuickStartTemplate('nope')).toBeNull()
  })
})
