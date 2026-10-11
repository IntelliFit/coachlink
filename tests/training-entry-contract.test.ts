import { describe, expect, it } from 'vitest';
import { canStartPlanDay, executionCapabilities, normalizePlanDays, resolveTrainingIntent, selectPlanAttempt, trainingEntry } from '@coachlink/core/src/trainingAccess';
import { buildPlanDayFacts } from '@coachlink/core/src/planDayFacts';
import { deriveStrictSequentialProgressDay } from '@coachlink/core/src/planProgress';
import { projectPlanCacheProgress } from '@coachlink/core/src/planCacheProgress';
import { buildPlanExecutionPreview } from '@coachlink/core/src/planExecutionPreview';

const days = [{ dayIndex: 76, type: 'rest' }, { dayIndex: 77, type: 'rest' }, { dayIndex: 78, type: 'training', actionSets: [{ action_id: 'pullup', params: { '组数': 5 } }] }, { dayIndex: 79, type: 'training' }];
const base = { trainingDays: days, progressDayIndex: 76, targetDayIndex: 78 };
describe('one training-entry contract for all clients', () => {
  it('D76/D77 pure rest permits D78 and the start label agrees', () => {
    expect(canStartPlanDay(base)).toBe(true);
    expect(trainingEntry(base)).toEqual({ intent: 'execute', label: '开始训练' });
  });
  it.each(['DIET', 'CARDIO', 'HABIT', 'STRENGTH', undefined])('never skips rest with prescribed work %s', type => {
    const withTasks = days.map(d => d.dayIndex === 77 ? { ...d, action_sets: [{ action_id: 'x', itemType: type }] } : d);
    expect(canStartPlanDay({ ...base, trainingDays: withTasks })).toBe(false);
    expect(trainingEntry({ ...base, trainingDays: withTasks }).intent).toBe('preview');
    expect(deriveStrictSequentialProgressDay({ planDays: withTasks, startExecutionDay: 76,
      executionsByDayIndex: {}, explicitStartDate: '2026-01-01', today: new Date('2026-10-08T00:00:00Z') }).recommendedDayIndex).toBe(77);
  });
  it('does not cross a previous unfinished workout', () => {
    expect(canStartPlanDay({ ...base, targetDayIndex: 79 })).toBe(false);
    expect(canStartPlanDay({ ...base, progressDayIndex: 79 })).toBe(false);
  });
  it('recognizes execution-added lightweight tasks', () => {
    expect(canStartPlanDay({ ...base, executionsByDayIndex: { 77: { action_executions: [{ item_type: 'HABIT' }] } } })).toBe(false);
  });
  it('normalizes legacy fields, order and case', () => {
    const old = [{ day_index: 78, type: 'TRAINING' }, { day_index: 77, type: 'REST' }, { day_index: 76, type: 'REST' }];
    expect(normalizePlanDays(old).map(d => d.dayIndex)).toEqual([76, 77, 78]);
    expect(canStartPlanDay({ ...base, trainingDays: old })).toBe(true);
  });
  it('explicit execute intent overrides legacy readonly, absent intent remains a safe preview', () => {
    expect(resolveTrainingIntent('execute', '1')).toBe('execute');
    expect(resolveTrainingIntent(undefined, 'true')).toBe('preview');
    expect(resolveTrainingIntent('review', false)).toBe('review');
  });
  it.each(['preview', 'in_progress', 'completed', 'timed_out', 'abandoned'])('cache-only %s grants no writes', status => {
    const c = executionCapabilities({ id: 'persisted', status }, 'execute', false);
    expect(c.canRecord || c.canCorrect || c.canRecover).toBe(false);
  });
  it.each(['in_progress', 'completed', 'timed_out', 'abandoned'])('explicit preview of %s grants no writes', status => {
    const c = executionCapabilities({ id: 'persisted', status }, 'preview');
    expect(c.canRecord || c.canCorrect || c.canRecover).toBe(false);
  });
  it('active, completed and timeout have different capabilities, not one readonly switch', () => {
    expect(executionCapabilities({ id: 'a', status: 'in_progress' }, 'execute').canRecord).toBe(true);
    expect(executionCapabilities({ id: 'c', status: 'completed' }, 'review').canCorrect).toBe(true);
    const timeout = executionCapabilities({ id: 't', status: 'timed_out' }, 'execute');
    expect(timeout.canRecord).toBe(false); expect(timeout.canRecover).toBe(true);
    expect(executionCapabilities({ id: 'preview-78', status: 'in_progress' }, 'execute').canRecord).toBe(false);
  });
  it('chooses one display attempt regardless of query order, without losing completion facts', () => {
    const rows = [{ id: 'done', day_index: 78, status: 'completed' }, { id: 'active', day_index: 78, status: 'in_progress' }, { id: 'timeout', day_index: 78, status: 'timed_out' }];
    expect(selectPlanAttempt(rows).id).toBe(selectPlanAttempt([...rows].reverse()).id);
    expect(selectPlanAttempt(rows).id).toBe('done');
    expect(buildPlanDayFacts(rows)[78].status).toBe('completed');
  });
  it('does not label a stale out-of-sequence active record as continue training', () => {
    expect(trainingEntry({ ...base, progressDayIndex: 79, execution: { status: 'in_progress' } }))
      .toEqual({ intent: 'preview', label: '查看待处理记录' });
  });
  it('successful completion updates pointer and uses actual completion date, not cache-write date', () => {
    const block = projectPlanCacheProgress({ instance: { training_days: days, start_execution_day: 76, start_date: '2026-01-01' },
      dayIndex: 78, executionsByDayIndex: { 78: { id: 'done', day_index: 78, status: 'completed', completed_at: '2026-10-05T08:00:00Z' } } }, new Date('2026-10-08T00:00:00Z'));
    expect(block.dayIndex).toBe(79); expect(block.recommendedDayIndex).toBe(79);
    expect(block.completionDates[78]).toBe('2026-10-05T08:00:00Z'); expect(block.todayCompleted).toBe(false);
  });
  it('preview renders prescriptions but cannot be submitted as an execution', () => {
    const preview = buildPlanExecutionPreview({ id: 'plan', training_days: days }, { pullup: { name: '负重引体' } }, 78);
    expect(preview.action_executions[0].sets).toHaveLength(5);
    expect(executionCapabilities(preview, 'execute').canRecord).toBe(false);
  });
});
