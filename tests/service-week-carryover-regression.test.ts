import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabaseClient', () => ({ default: {} }));
import { deriveSubscriptionCarryoverSummaryFromHistory as carry } from '@/lib/subscriptionCarryover';
import { computeConsumedServiceWeeks } from '@/lib/subscriptionServiceWeeks';
import { computeCreditsScope } from '@/lib/subscriptionCredits';
import { deriveSubscriptionEntitlementState as entitlement } from '@/lib/subscriptionEntitlementModel';
import { evaluateSubscriptionPlanAccess as access } from '@/lib/subscriptionAccess';
const plan = (frequency = 3, weeks = 8, late = false) => Array.from({ length: weeks * 7 }, (_, i) => ({
  dayIndex: i + 1, type: (late ? i % 7 >= 7 - frequency : i % 7 < frequency) ? 'training' : 'rest',
}));
const old = { id: 'old', created_at: '2026-09-01', status: 'archived', training_days: plan() };
const row = (day_index: number, instance_id = 'old', status = 'completed') => ({ day_index, instance_id, status });
const summary = (executions = [row(1)], extra = {}) => carry({ subscribedWeeks: 4, instances: [old], executions, ...extra });
const subscription = { status: 'active', subscribed_weeks: 4, start_date: '2026-09-01' };
const now = new Date('2026-09-28T00:00:00Z');
describe('service weeks survive partial weeks and frequency changes', () => {
  it('one of three sessions consumes 1/3 week, not a whole week', () => {
    expect(summary().progressedWeeks).toBeCloseTo(1 / 3, 12);
    expect(summary().remainingWeeks).toBeCloseTo(11 / 3, 12);
  });
  it('same frequency retains 11 sessions including the paid fractional week', () => {
    expect(computeCreditsScope({ trainingDays: plan(), subscribedWeeks: summary().remainingWeeks }).totalCredits).toBe(11);
  });
  it('late-in-week sessions are not discarded by a calendar-day cutoff', () => {
    const scope = computeCreditsScope({ trainingDays: plan(3, 8, true), subscribedWeeks: 11 / 3 });
    expect(scope.totalCredits).toBe(11);
    expect(scope.eligibleTrainingDayIndexSet.has(27)).toBe(true);
    expect(scope.eligibleTrainingDayIndexSet.has(28)).toBe(false);
  });
  it.each([2, 3, 4, 5])('new frequency %i changes sessions, not remaining service weeks', frequency => {
    const state = entitlement({ subscription, planInstance: { id: 'next', training_days: plan(frequency) },
      effectiveSubscribedWeeks: summary().remainingWeeks, executions: [], now });
    expect(state.remainingServiceWeeks).toBeCloseTo(11 / 3, 12);
    expect(state.totalCredits).toBe(Math.ceil(11 / 3 * frequency - 1e-9));
    expect(state.displayEndDate).toBe('2026-10-24T00:00:00.000Z');
  });
  it('access allows the final partially paid session, blocks the next unpaid one', () => {
    const params = { subscription, trainingDays: plan(), effectiveSubscribedWeeks: 11 / 3, now };
    expect(access({ ...params, requestedDayIndex: 23 }).allowed).toBe(true);
    expect(access({ ...params, requestedDayIndex: 24 }).reason).toBe('PLAN_OUT_OF_SCOPE');
  });
  it('counts each original week by its own frequency', () => {
    const days = [...plan(3, 1), ...plan(4, 1).map(d => ({ ...d, dayIndex: d.dayIndex + 7 }))];
    expect(computeConsumedServiceWeeks({ trainingDays: days, executions: [row(1), row(8)] })).toBeCloseTo(1 / 3 + 1 / 4);
  });
  it('a completed day is charged once despite retries, and skips/rest do not consume service', () => {
    expect(summary([row(1), row(1), row(2, 'old', 'abandoned'), row(4)]).progressedWeeks).toBeCloseTo(1 / 3);
  });
  it('a gap between completed weeks is not charged as a full intervening week', () => {
    expect(summary([row(1), row(15)]).progressedWeeks).toBeCloseTo(2 / 3);
  });
  it('offline progress and online completion of the same day are deduplicated', () => {
    expect(summary([row(1)], { instances: [{ ...old, start_execution_day: 2 }] }).progressedWeeks).toBeCloseTo(1 / 3);
  });
  it('no-charge revision is excluded while carried offline progress is charged once', () => {
    const instances = [{ ...old, entitlement_consumption_policy: 'no_charge' },
      { ...old, id: 'revision', created_at: '2026-09-02', start_execution_day: 2 }];
    expect(summary([row(1)], { instances }).progressedWeeks).toBeCloseTo(1 / 3);
  });
  it('switching frequency twice subtracts service fractions, never multiplies a fixed balance', () => {
    const instances = [old, { ...old, id: 'second', created_at: '2026-09-02', training_days: plan(4) }];
    expect(summary([row(1), row(1, 'second')], { instances }).remainingWeeks).toBeCloseTo(4 - 1 / 3 - 1 / 4);
  });
  it('an excluded current instance does not consume historical carryover again', () => {
    expect(summary([row(1)], { excludeInstanceId: 'old' }).remainingWeeks).toBe(4);
  });
  it('historical training content missing fails closed instead of inventing a frequency', () => {
    expect(() => summary([row(1)], { instances: [{ id: 'old' }] })).toThrow('历史计划内容缺失');
  });
  it('pre-subscription completions follow the explicit history-consumption policy', () => {
    const executions = [{ ...row(1), completed_at: '2026-08-01' }];
    expect(summary(executions, { subscriptionStartDate: '2026-09-01' }).remainingWeeks).toBe(4);
    expect(summary(executions, { subscriptionStartDate: '2026-09-01', instances: [{ ...old,
      entitlement_consumption_policy: 'count_all_history' }] }).remainingWeeks).toBeCloseTo(11 / 3);
  });
  it('complete weekly fractions cannot leave an epsilon entitlement alive', () => {
    const executions = plan(3, 4).filter(d => d.type === 'training').map(d => row(d.dayIndex));
    expect(summary(executions).remainingWeeks).toBe(0);
    expect(summary(executions).exhausted).toBe(true);
  });
});
