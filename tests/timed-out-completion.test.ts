import { beforeEach, describe, expect, it, vi } from 'vitest';
import { describePendingTimedOutDay, findPendingTimedOutDay } from '@coachlink/core/src/pendingTimedOutDay';

const state = vi.hoisted(() => ({
  user: '20000000-0000-4000-8000-000000000001',
  rows: {} as Record<string, any[]>, rpc: vi.fn(), access: vi.fn(), refresh: vi.fn(),
}));
vi.mock('@/lib/getApiUserId', () => ({ getApiUserId: async () => state.user }));
vi.mock('@/app/api/execution/_helpers/subscriptionAccess', () => ({ validateExecutionSubscriptionAccess: state.access }));
vi.mock('@/app/api/execution/updateEstimatedEndDate', () => ({ updateEstimatedEndDateForInstance: state.refresh }));
vi.mock('@/lib/supabaseClient', () => ({ serviceRoleSupabase: {
  rpc: state.rpc,
  from(table: string) {
    const filters: Array<[string, any]> = [];
    const result = (single: boolean) => {
      const rows = (state.rows[table] || []).filter((row) => filters.every(([key, value]) => row[key] === value));
      return { data: single ? rows[0] || null : rows, error: null };
    };
    const query: any = { select: () => query, eq: (key: string, value: any) => { filters.push([key, value]); return query; },
      maybeSingle: async () => result(true), then: (resolve: any) => Promise.resolve(result(false)).then(resolve) };
    return query;
  },
} }));

import { POST } from '@/app/api/execution/record-completion/route';

const plan = '10000000-0000-4000-8000-000000000001';
const executionId = '40000000-0000-4000-8000-000000000001';
const requestId = '30000000-0000-4000-8000-000000000001';
// The student's copy was read on 10/20 evening; the timeout closed the row on 10/22.
const studentCopy = '2026-10-20T10:08:00.000Z';
const timedOutAt = '2026-10-22T01:00:00.000Z';

const timedOutRow = (extra: Record<string, any> = {}) => ({
  id: executionId, instance_id: plan, student_id: state.user, day_index: 1, status: 'timed_out',
  close_reason: 'hard_timeout_5h', started_at: '2026-10-20T09:03:00Z', last_saved_at: studentCopy,
  ended_at: timedOutAt, updated_at: timedOutAt, completed_sets: 16, total_sets: 17, ...extra,
});
const call = () => POST(new Request('http://localhost/api/execution/record-completion', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ instanceId: plan, dayIndex: 1, performedOn: '2026-10-20', requestId, executionId, expectedUpdatedAt: studentCopy }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.rows = { coach_plan_instances: [{ id: plan, student_id: state.user, start_date: '2026-10-01', status: 'active',
    training_days: [{ dayIndex: 1, type: 'training' }] }] };
  state.access.mockResolvedValue({ allowed: true });
  state.rpc.mockResolvedValue({ data: [{ id: executionId, status: 'completed' }], error: null });
});

describe('confirming a workout the timeout closed meanwhile', () => {
  it('goes through when the 5-hour timeout is the only change since the student read it', async () => {
    state.rows.plan_instance_executions = [timedOutRow()];
    expect((await call()).status).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith('record_plan_completion_date', expect.objectContaining({ p_expected_updated_at: timedOutAt }));
  });

  it('still refuses when the student recorded more after the copy was read', async () => {
    state.rows.plan_instance_executions = [timedOutRow({ last_saved_at: '2026-10-21T02:00:00.000Z' })];
    await call();
    expect(state.rpc).toHaveBeenCalledWith('record_plan_completion_date', expect.objectContaining({ p_expected_updated_at: studentCopy }));
  });

  it('still refuses when something else changed the row after the timeout', async () => {
    state.rows.plan_instance_executions = [timedOutRow({ updated_at: '2026-10-22T05:00:00.000Z' })];
    await call();
    expect(state.rpc).toHaveBeenCalledWith('record_plan_completion_date', expect.objectContaining({ p_expected_updated_at: studentCopy }));
  });
});

describe('findPendingTimedOutDay', () => {
  it('surfaces the unconfirmed workout the plan is waiting on, with what was recorded', () => {
    const pending = findPendingTimedOutDay({ progressDayIndex: 15, executionsByDayIndex: {
      15: { id: 'e15', status: 'timed_out', completed_sets: 16, total_sets: 17, started_at: '2026-10-20T09:03:00Z' },
    } });
    expect(pending).toMatchObject({ dayIndex: 15, executionId: 'e15', completedSets: 16, totalSets: 17, startedLabel: '10月20日', canConfirmRecorded: true });
    expect(describePendingTimedOutDay(pending!).title).toBe('第15天（10月20日）还没确认完成');
  });

  it('asks to restart instead of confirming when nothing was recorded', () => {
    const pending = findPendingTimedOutDay({ progressDayIndex: 3, executionsByDayIndex: {
      3: { id: 'e3', status: 'timed_out', completed_sets: 0, total_sets: 12, started_at: '2026-10-20T09:03:00Z' },
    } });
    expect(pending?.canConfirmRecorded).toBe(false);
    expect(describePendingTimedOutDay(pending!).handleLabel).toBe('重新开始');
  });

  it('stays quiet for in-progress or completed days', () => {
    expect(findPendingTimedOutDay({ progressDayIndex: 5, executionsByDayIndex: { 5: { id: 'e5', status: 'in_progress' } } })).toBeNull();
    expect(findPendingTimedOutDay({ progressDayIndex: 5, executionsByDayIndex: {} })).toBeNull();
  });
});
