import { describe, expect, it } from 'vitest';
import { deriveSubscriptionBalance, pickCurrentPlanInstance } from '@/lib/subscriptionBalance';

const weeks = (count: number, perWeek: number) => Array.from({ length: count * 7 }, (_, index) => ({
  dayIndex: index + 1, type: index % 7 < perWeek ? 'training' : 'rest',
}));
const done = (instance_id: string, ...days: number[]) => days.map((day_index) => ({ instance_id, day_index, status: 'completed', completed_at: '2026-09-10T00:00:00Z' }));

describe('pickCurrentPlanInstance', () => {
  it('prefers the running plan over an older completed phase, whatever the row order', () => {
    const completed = { id: 'a-old', status: 'completed', created_at: '2026-08-01', training_days: weeks(4, 3) };
    const active = { id: 'z-new', status: 'active', created_at: '2026-09-01', training_days: weeks(4, 3) };
    expect(pickCurrentPlanInstance([completed, active])?.id).toBe('z-new');
    expect(pickCurrentPlanInstance([active, completed])?.id).toBe('z-new');
  });

  it('falls back to the newest completed plan and never picks an archived one', () => {
    const plans = [
      { id: 'p1', status: 'completed', created_at: '2026-06-01', training_days: weeks(4, 3) },
      { id: 'p2', status: 'completed', created_at: '2026-08-01', training_days: weeks(4, 3) },
      { id: 'p3', status: 'archived', created_at: '2026-09-01', training_days: weeks(4, 3) },
    ];
    expect(pickCurrentPlanInstance(plans)?.id).toBe('p2');
  });
});

describe('deriveSubscriptionBalance', () => {
  it('charges the finished phase as history and the running plan by its own sessions', () => {
    const subscription = { status: 'active', start_date: '2026-08-01T00:00:00Z', subscribed_weeks: 12 };
    const instances = [
      { id: 'phase-1', status: 'completed', created_at: '2026-08-01', start_execution_day: 1, training_days: weeks(4, 3) },
      { id: 'phase-2', status: 'active', created_at: '2026-09-01', start_execution_day: 1, training_days: weeks(4, 3) },
    ];
    const executions = [...done('phase-1', 1, 2, 3, 8, 9, 10, 15, 16, 17, 22, 23, 24), ...done('phase-2', 1, 2, 3)];
    const balance = deriveSubscriptionBalance({ subscription, instances, executions, now: new Date('2026-09-12T00:00:00Z') });
    expect(balance?.currentInstance?.id).toBe('phase-2');
    expect(balance?.carryover.remainingWeeks).toBe(8);
    expect(balance?.state.remainingServiceWeeks).toBe(7);
  });
});
