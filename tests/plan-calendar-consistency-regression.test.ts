import { describe, expect, it } from 'vitest';
import { buildPlanScheduleModel, canViewPlanDay } from '../packages/core/src/planCalendar';
import { buildPlanScheduleModel as webCalendar } from '@/app/today-training/lib/dayModules';
import { toBeijingDateKey } from '../packages/core/src/beijingTime';
import { isCalendarDate, suggestPerformedOn, validatePerformedOn } from '../packages/core/src/completionDate';
import { deriveStrictSequentialProgressDay } from '@/lib/planProgress';
import { buildPlanDayFacts } from '@/lib/planDayFacts';
import { readFileSync } from 'node:fs';

const completed = (day: number, date: string, extra = {}) => ({ day_index: day, status: 'completed',
  completed_at: `${date}T08:00:00+08:00`, started_at: `${date}T07:00:00+08:00`, ...extra });
const days = Array.from({ length: 10 }, (_, i) => ({ dayIndex: i + 1, type: i % 3 === 0 ? 'training' : 'rest', actionSets: [] }));
const model = (overrides = {}) => buildPlanScheduleModel({ trainingDays: days, effectiveStartDate: '2026-09-01',
  progressDayIndex: 7, today: new Date('2026-09-26T09:00:00+08:00'), ...overrides });

describe('one calendar and original-plan progress', () => {
  it('Web uses the shared function and WeChat re-exports that exact module', () => {
    expect(webCalendar).toBe(buildPlanScheduleModel);
    expect(readFileSync('apps/wechat/src/training/today-training/lib/dayModules.ts', 'utf8'))
      .toContain("export { buildPlanScheduleModel, resolvePlanDayDate } from '@coachlink/core/src/planCalendar'");
  });
  it('preserves both workouts on one date, hiding only intervening pure recovery days', () => {
    const result = model({ executionsByDayIndex: { 1: completed(1, '2026-09-10'), 4: completed(4, '2026-09-10') } });
    expect(result.dayIndexesByDateKey.get('2026-09-10')).toEqual([1, 4]);
    expect(result.scheduleByDayIndex.get(2)?.hidden).toBe(true);
    expect(result.postponedByDateKey.has('2026-09-10')).toBe(false);
  });
  it('never hides a recovery day with prescribed tasks', () => {
    const result = model({ trainingDays: days.map(d => d.dayIndex === 2 ? { ...d, actionSets: [{ itemType: 'HABIT' }] } : d),
      executionsByDayIndex: { 1: completed(1, '2026-09-10'), 4: completed(4, '2026-09-10') } });
    expect(result.scheduleByDayIndex.get(2)?.hidden).toBe(false);
  });
  it('uses Beijing dates at a UTC midnight boundary', () => {
    const result = model({ executionsByDayIndex: { 1: completed(1, '2026-09-10', { completed_at: '2026-09-10T16:30:00Z' }) } });
    expect(result.dayIndexesByDateKey.get('2026-09-11')).toContain(1);
  });
  it('a stale in-progress start cannot pin today back in the past', () => {
    const result = model({ progressDayIndex: 1, executionsByDayIndex: { 1: { status: 'in_progress', started_at: '2026-09-01' } } });
    expect(toBeijingDateKey(result.scheduleByDayIndex.get(1)!.displayDate)).toBe('2026-09-26');
  });
  it('flags inverted legacy dates without fabricating history or shifting all future dates', () => {
    const result = model({ executionsByDayIndex: { 1: completed(1, '2026-09-25'), 4: completed(4, '2026-09-20') } });
    expect(toBeijingDateKey(result.scheduleByDayIndex.get(1)!.displayDate)).toBe('2026-09-25');
    expect(result.scheduleByDayIndex.get(1)?.dateNeedsReview).toBe(true);
    expect(toBeijingDateKey(result.scheduleByDayIndex.get(5)!.displayDate)).toBe('2026-09-21');
  });
  it('allows saved historical records without unlocking unrecorded future weeks', () => {
    expect(canViewPlanDay(60, 2, { status: 'completed' })).toBe(true);
    expect(canViewPlanDay(60, 2, { status: 'timed_out' })).toBe(true);
    expect(canViewPlanDay(60, 2)).toBe(false);
  });
  it('a new empty attempt cannot mask an existing completed plan-day fact', () => {
    const facts = buildPlanDayFacts([completed(1, '2026-09-10'), { day_index: 1, status: 'in_progress', started_at: '2026-09-26' }]);
    expect(facts[1].status).toBe('completed');
  });
  it('calendar keeps the completed-day date while a replacement attempt is editable', () => {
    const result = model({ completionDates: { 1: '2026-09-10T08:00:00+08:00' },
      executionsByDayIndex: { 1: { status: 'in_progress', started_at: '2026-09-26' } } });
    expect(toBeijingDateKey(result.scheduleByDayIndex.get(1)!.displayDate)).toBe('2026-09-10');
  });
  it('reproduces 6196 legacy date inversions without rewinding completed D67', () => {
    const training = new Set([50,53,57,60,64,67,71]);
    const planDays = Array.from({length:23}, (_, i) => ({dayIndex:i+50, type:training.has(i+50)?'training':'rest', actionSets:[]}));
    const executionsByDayIndex = Object.fromEntries([[50,'2026-09-07'],[53,'2026-09-24'],[57,'2026-09-25'],
      [60,'2026-09-17'],[64,'2026-09-21'],[67,'2026-09-23']].map(([d,date]) => [d,completed(Number(d),String(date))]));
    const progress = deriveStrictSequentialProgressDay({ planDays, startExecutionDay:50, executionsByDayIndex,
      explicitStartDate:'2026-06-25', today:new Date('2026-09-26T08:00:00+08:00') });
    expect(progress.recommendedDayIndex).toBe(71);
    const result = model({ trainingDays:planDays, executionsByDayIndex, startExecutionDay:50, progressDayIndex:71 });
    expect(toBeijingDateKey(result.scheduleByDayIndex.get(68)!.displayDate)).toBe('2026-09-24');
    expect(result.dayIndexesByDateKey.get('2026-09-24')).toEqual([53,68]);
  });
  it('late confirmation of D1 cannot rewind progress before completed D4', () => {
    const result = deriveStrictSequentialProgressDay({ planDays: days, startExecutionDay: 1,
      explicitStartDate: '2026-09-01', today: new Date('2026-09-26T08:00:00+08:00'),
      executionsByDayIndex: { 1: completed(1, '2026-09-25'), 4: completed(4, '2026-09-20') } });
    expect(result.recommendedDayIndex).toBe(7);
  });
  it('still stops at the first missing training, even if a later day has history', () => {
    const result = deriveStrictSequentialProgressDay({ planDays: days, startExecutionDay: 1,
      explicitStartDate: '2026-09-01', today: new Date('2026-09-26'),
      executionsByDayIndex: { 1: completed(1, '2026-09-10'), 7: completed(7, '2026-09-20') } });
    expect(result.recommendedDayIndex).toBe(4);
  });
  it('does not cross an unresolved recovery task', () => {
    const result = deriveStrictSequentialProgressDay({ planDays: days.map(d => d.dayIndex === 2 ? { ...d, actionSets: [{ itemType: 'HABIT' }] } : d),
      startExecutionDay: 1, today: new Date('2026-09-26'),
      executionsByDayIndex: { 1: completed(1, '2026-09-10'), 4: completed(4, '2026-09-20') } });
    expect(result.recommendedDayIndex).toBe(2);
  });
});

describe('explicit actual training dates', () => {
  it.each(['2026-02-29', '2026-09-31', '2026-13-01', '2026-9-1', null])('rejects invalid calendar date %s', date => {
    expect(isCalendarDate(date)).toBe(false);
  });
  it('accepts leap day and rejects future / pre-plan dates', () => {
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(validatePerformedOn('2026-09-27', '2026-09-01', new Date('2026-09-26'))).toBeTruthy();
    expect(validatePerformedOn('2026-08-31', '2026-09-01', new Date('2026-09-26'))).toBeTruthy();
  });
  it('does not suggest a planned date or an empty start as actual training evidence', () => {
    expect(suggestPerformedOn({ started_at: '2026-09-01', completed_sets: 0 })).toBe('');
    expect(suggestPerformedOn({ started_at: '2026-09-01T08:00:00Z', last_saved_at: '2026-09-02T08:00:00Z', completed_sets: 2 })).toBe('');
  });
  it('can suggest a recent meaningful save but prefers an explicitly confirmed date', () => {
    expect(suggestPerformedOn({ started_at: '2026-09-10T08:00:00Z', last_saved_at: '2026-09-10T09:00:00Z', completed_sets: 2 })).toBe('2026-09-10');
    expect(suggestPerformedOn({ performed_on: '2026-09-09', completed_at: '2026-09-26' })).toBe('2026-09-09');
  });
});
