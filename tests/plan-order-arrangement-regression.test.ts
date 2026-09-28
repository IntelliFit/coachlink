import { describe, expect, it } from 'vitest';
import { buildPlanScheduleModel } from '../packages/core/src/planCalendar';
import { toBeijingDateKey } from '../packages/core/src/beijingTime';
import { deriveEffectiveStartExecutionDay } from '@/lib/planProgress';
import { readFileSync } from 'node:fs';

// Anonymous reproduction of the complete June–September sequence, not just D71.
const training = [1,4,8,11,15,18,22,25,29,32,36,39,43,46,50,53,57,60,64,67,71,74,78,81];
const days = Array.from({ length: 84 }, (_, i) => ({ dayIndex: i + 1,
  type: training.includes(i + 1) ? 'training' : 'rest', actionSets: [] }));
const rows = [
  [1,'06-26','07-06','07-06'], [4,'07-10','07-10','07-10'],
  [8,'07-13','07-14','07-13'], [11,'07-17','07-17','07-17'],
  [15,'07-20','07-24','07-20'], [18,'07-24','07-25','07-24'],
  [22,'08-03','08-03','08-03'], [25,'08-07','08-10','08-10'],
  [29,'08-10','08-19','08-10'], [32,'08-19','08-20','08-20'],
  [36,'08-24','08-28','08-24'], [39,'08-28','08-30','08-30'],
  [43,'08-30','08-30','09-04'], [46,'09-04','09-07','09-07'],
  [50,'09-07','09-07','09-07'], [53,'09-11','09-24','09-24'],
  [57,'09-17','09-25','09-25'], [60,'09-17','09-17','09-17'],
  [64,'09-21','09-21','09-21'], [67,'09-23','09-23','09-23'],
] as const;
const executions = Object.fromEntries(rows.map(([day, start, complete, saved]) => [day, {
  day_index: day, status: 'completed', started_at: `2026-${start}T12:00:00+08:00`,
  completed_at: `2026-${complete}T15:00:00+08:00`, last_saved_at: `2026-${saved}T14:00:00+08:00`,
  completed_sets: 10,
}]));
const args = { trainingDays: days, executionsByDayIndex: executions, effectiveStartDate: '2026-06-25',
  startExecutionDay: 1, progressDayIndex: 71, today: new Date('2026-09-28T09:00:00+08:00') };
const arrange = (overrides = {}) => buildPlanScheduleModel({ ...args, dateBasis: 'plan-order', ...overrides });
const date = (model: ReturnType<typeof arrange>, day: number) => toBeijingDateKey(model.scheduleByDayIndex.get(day)!.displayDate);

describe('original-plan arrangement is independent of late submissions', () => {
  it('keeps D1 despite subscription crossing Beijing midnight', () => {
    expect(deriveEffectiveStartExecutionDay({ storedStartExecutionDay: 1, planDays: days,
      executionsByDayIndex: executions, planStartDate: '2026-06-25',
      subscriptionStartDate: '2026-06-25T17:58:21.135Z' })).toBe(1);
  });
  it('still respects an explicit offline migration start', () => {
    expect(deriveEffectiveStartExecutionDay({ storedStartExecutionDay: 22, planDays: days,
      executionsByDayIndex: executions })).toBe(22);
  });
  it('places the first completed workout on July 6, not original June 25 or auto-created June 26', () => {
    const result = arrange();
    expect(date(result, 1)).toBe('2026-07-06');
    expect(result.dayIndexesByDateKey.get('2026-07-06')).toContain(1);
  });
  it('does not erase a saved record before an explicit execution start', () => {
    expect(date(arrange({ startExecutionDay: 2 }), 1)).toBe('2026-07-06');
  });
  it.each([[25,'08-07'],[29,'08-10'],[36,'08-24'],[46,'09-04'],[53,'09-11'],[57,'09-14']] as const)(
    'restores D%s arrangement to %s and explicitly labels the estimate', (day, expected) => {
      const result = arrange();
      expect(date(result, day)).toBe(`2026-${expected}`);
      expect(result.scheduleByDayIndex.get(day)?.dateEstimated).toBe(true);
      expect(toBeijingDateKey(result.scheduleByDayIndex.get(day)!.recordedDate!))
        .toBe(toBeijingDateKey(executions[day].completed_at));
    });
  it('has no reversed or missing completed training days across all four months', () => {
    const result = arrange();
    const dates = rows.map(([day]) => date(result, day));
    expect(dates).toEqual([...dates].sort());
    const displayed = [...result.dayIndexesByDateKey.values()].flat();
    for (const [day] of rows) expect(displayed.filter(d => d === day)).toHaveLength(1);
    expect(date(result, 71)).toBe('2026-09-28');
    expect(date(result, 60)).toBe('2026-09-17');
    expect(date(result, 64)).toBe('2026-09-21');
    expect(date(result, 67)).toBe('2026-09-23');
    expect(result.dayIndexesByDateKey.get('2026-09-24')).not.toContain(53);
    expect(result.dayIndexesByDateKey.get('2026-09-25')).not.toContain(57);
  });
  it('does not mutate dates, status, weights, or input objects', () => {
    const before = JSON.stringify(args);
    arrange(); arrange();
    expect(JSON.stringify(args)).toBe(before);
  });
  it('retains the recorded history view for audit instead of overwriting evidence', () => {
    expect(date(buildPlanScheduleModel(args), 53)).toBe('2026-09-24');
    expect(date(buildPlanScheduleModel(args), 57)).toBe('2026-09-25');
  });
  it('honors a confirmed performed_on over stale completionDates', () => {
    const result = arrange({ executionsByDayIndex: { ...executions, 53: { ...executions[53], performed_on: '2026-09-12' } },
      completionDates: { 53: executions[53].completed_at } });
    expect(date(result, 53)).toBe('2026-09-12');
    expect(result.scheduleByDayIndex.get(53)?.dateEstimated).toBe(false);
  });
  it('does not redate D43 to a later content edit on September 4', () => {
    expect(date(arrange(), 43)).toBe('2026-08-30');
  });
  it('retains genuine same-day completions', () => {
    const completed = { status: 'completed', started_at: '2026-09-01T08:00:00+08:00', completed_at: '2026-09-01T09:00:00+08:00' };
    const result = arrange({ executionsByDayIndex: { 1: completed, 4: completed } });
    expect(result.dayIndexesByDateKey.get('2026-09-01')).toEqual([1,4]);
  });
  it('can restore original order even when legacy data has no start/save evidence', () => {
    const result = arrange({ executionsByDayIndex: {}, completionDates: {
      50:'2026-09-07',53:'2026-09-24',57:'2026-09-25',60:'2026-09-17',64:'2026-09-21',67:'2026-09-23',
    } });
    const dates = [50,53,57,60,64,67].map(d => date(result, d));
    expect(dates).toEqual([...dates].sort());
    expect(result.scheduleByDayIndex.get(53)?.dateEstimated).toBe(true);
  });
  it('both frontend entry points opt into plan-order and disclose estimates', () => {
    for (const file of ['src/app/today-training/page.tsx','apps/wechat/src/training/today-training/TodayTrainingScreen.tsx']) {
      expect(readFileSync(file,'utf8')).toContain("dateBasis: 'plan-order'");
    }
    for (const file of ['src/app/today-training/BrowseSection.tsx','apps/wechat/src/training/today-training/components/ScheduleCalendarPanel.tsx']) {
      expect(readFileSync(file,'utf8')).toContain('dateEstimated');
      expect(readFileSync(file,'utf8')).toContain('推算');
    }
  });
});
