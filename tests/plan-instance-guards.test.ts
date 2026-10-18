import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseExecContext } from '@/testUtils/mockSupabase';

const state = vi.hoisted(() => ({
  userId: 'coach-user',
  tables: {} as Record<string, any[]>,
  writes: [] as Array<{ table: string; op: string; payload: any }>,
}));

vi.mock('@/lib/supabaseClient', async () => {
  const { createMockSupabase } = await import('@/testUtils/mockSupabase');
  const matches = (row: any, ctx: SupabaseExecContext) => ctx.filters.every((filter) => {
    const [column, value] = filter.args;
    if (filter.kind === 'eq') return row[column] === value;
    if (filter.kind === 'neq') return row[column] !== value;
    if (filter.kind === 'in') return (value as unknown[]).includes(row[column]);
    return true;
  });
  const client = createMockSupabase((ctx) => {
    const rows = state.tables[ctx.table] || [];
    const one = ctx.filters.some((filter) => filter.kind === 'single' || filter.kind === 'maybeSingle');
    if (ctx.op === 'update' || ctx.op === 'insert') {
      state.writes.push({ table: ctx.table, op: ctx.op, payload: ctx.payload });
      const matched = ctx.op === 'update' ? rows.filter((row) => matches(row, ctx)) : [ctx.payload];
      const updated = matched.map((row) => ({ ...row, ...ctx.payload }));
      return { data: one ? updated[0] ?? null : updated, error: null };
    }
    const matched = rows.filter((row) => matches(row, ctx));
    return { data: one ? matched[0] ?? null : matched, error: null, count: matched.length };
  });
  return { default: client, serviceRoleSupabase: client };
});
vi.mock('@/app/api/auth/[...nextauth]/auth', () => ({
  getServerSession: async () => ({ user: { id: state.userId, is_coach: state.userId === 'coach-user' } }),
}));
vi.mock('@/app/api/plan-lib/sync-actions', () => ({ syncCoachActionsToStudentLibrary: vi.fn(async () => undefined) }));
vi.mock('@/lib/planExecutionLifecycle', () => ({
  expireTimedOutPlanExecutions: vi.fn(async () => []),
  activatePendingPlanRevisionForSource: vi.fn(async () => ({ activated: false, reason: 'no_pending_revision' })),
}));
vi.mock('@/lib/chat', () => ({ sendDirectMessage: vi.fn(async () => true) }));
vi.mock('@/lib/planCompletionAutomation', () => ({ schedulePlanCompletionAutomation: vi.fn() }));

import { POST as updateInstance } from '@/app/api/plan-lib/update-instance/route';
import { POST as createInstance } from '@/app/api/plan-lib/create-instance/route';
import { POST as archiveInstance } from '@/app/api/plan-lib/archive-instance/route';
import { POST as activateInstance } from '@/app/api/plan-lib/activate-instance/route';
import { POST as completeInstance } from '@/app/api/plan-lib/complete-instance/route';
import { schedulePlanCompletionAutomation } from '@/lib/planCompletionAutomation';

const set = (action_id: string, reps = 8) => ({ action_id, params: { 组数: 3, 次数: reps } });
const days = () => [
  { dayIndex: 1, type: 'training', actionSets: [set('squat')] },
  { dayIndex: 2, type: 'rest', actionSets: [] },
  { dayIndex: 3, type: 'training', actionSets: [set('pull')] },
  { dayIndex: 4, type: 'rest', actionSets: [] },
  { dayIndex: 5, type: 'training', actionSets: [set('dip')] },
];
const post = (body: unknown) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(body) });
const instanceWrites = () => state.writes.filter((write) => write.table === 'coach_plan_instances');

beforeEach(() => {
  state.userId = 'coach-user';
  state.writes = [];
  state.tables = {
    coaches: [{ id: 'coach-1', user_id: 'coach-user' }],
    coach_subscriptions: [{ id: 'sub-1', coach_id: 'coach-1', student_id: 'student-user', subscribed_weeks: 4, start_date: '2026-10-01' }],
    coach_plan_instances: [
      { id: 'plan-1', coach_id: 'coach-1', student_id: 'student-user', coach_subscription_id: 'sub-1', status: 'active',
        start_execution_day: 1, start_date: '2026-10-01', training_days: days() },
      { id: 'self-1', coach_id: null, student_id: 'student-user', coach_subscription_id: null, source: 'self', status: 'active',
        start_execution_day: 1, training_days: days() },
    ],
    plan_instance_executions: [
      { id: 'e1', instance_id: 'plan-1', day_index: 1, status: 'completed' },
      { id: 'e2', instance_id: 'plan-1', day_index: 3, status: 'abandoned' },
      { id: 'e3', instance_id: 'self-1', day_index: 1, status: 'completed' },
    ],
  };
});

describe('update-instance', () => {
  it('does not let a student edit the coach plan they are enrolled in', async () => {
    state.userId = 'student-user';
    const response = await updateInstance(post({ id: 'plan-1', startExecutionDay: 5 }));
    expect(response.status).toBe(403);
    expect(instanceWrites()).toEqual([]);
  });

  it('lets the coach change sets and reps on a day that was already trained', async () => {
    const next = days().map((day) => (day.dayIndex === 1 ? { ...day, actionSets: [set('squat', 5)] } : day));
    const response = await updateInstance(post({ id: 'plan-1', trainingDays: next }));
    expect(response.status).toBe(200);
    expect(instanceWrites()[0].payload.training_days).toEqual(next);
  });

  it('rejects deleting a day before the student’s furthest workout', async () => {
    const next = days().filter((day) => day.dayIndex !== 2).map((day, index) => ({ ...day, dayIndex: index + 1 }));
    const response = await updateInstance(post({ id: 'plan-1', trainingDays: next }));
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.code).toBe('PLAN_DAYS_LOCKED');
    expect(body.message).toContain('第2天');
    expect(instanceWrites()).toEqual([]);
  });

  it('allows any change after the last trained day', async () => {
    const next = [...days().slice(0, 3), { dayIndex: 4, type: 'training', actionSets: [set('row')] }];
    const response = await updateInstance(post({ id: 'plan-1', trainingDays: next }));
    expect(response.status).toBe(200);
  });

  it('rejects moving the start day of a plan that already has workouts', async () => {
    const response = await updateInstance(post({ id: 'plan-1', startExecutionDay: 3 }));
    expect(response.status).toBe(409);
    expect(instanceWrites()).toEqual([]);
  });

  it('only lets status move between active and paused', async () => {
    expect((await updateInstance(post({ id: 'plan-1', status: 'paused' }))).status).toBe(200);
    expect((await updateInstance(post({ id: 'plan-1', status: 'archived' }))).status).toBe(400);
  });

  it('refuses to hand a plan to another student or coach', async () => {
    const response = await updateInstance(post({ id: 'plan-1', studentId: 'someone-else' }));
    expect(response.status).toBe(400);
    expect(instanceWrites()).toEqual([]);
  });

  it('still lets a student edit a plan they created for themselves', async () => {
    state.userId = 'student-user';
    const response = await updateInstance(post({ id: 'self-1', name: '我的计划' }));
    expect(response.status).toBe(200);
  });
});

describe('create-instance as an in-place revision', () => {
  const revision = (trainingDays: unknown) => post({
    name: '更新后的计划', subscriptionId: 'sub-1', revisionOfInstanceId: 'plan-1', trainingDays,
  });

  it('rejects restructuring trained days', async () => {
    const next = days().map((day) => (day.dayIndex === 2 ? { dayIndex: 2, type: 'training', actionSets: [set('row')] } : day));
    const response = await createInstance(revision(next));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('PLAN_DAYS_LOCKED');
    expect(instanceWrites()).toEqual([]);
  });

  it('keeps the original start day so skipped days are not charged as carried progress', async () => {
    const next = days().map((day) => (day.dayIndex === 5 ? { ...day, actionSets: [set('press')] } : day));
    const response = await createInstance(revision(next));
    expect(response.status).toBe(200);
    expect(instanceWrites()[0].payload.start_execution_day).toBe(1);
  });
});

describe('archive-instance', () => {
  it('does not let a student archive their coach plan', async () => {
    state.userId = 'student-user';
    const response = await archiveInstance(post({ instanceId: 'plan-1', entitlementPolicy: 'no_charge' }));
    expect(response.status).toBe(403);
    expect(instanceWrites()).toEqual([]);
  });

  it('ignores billing overrides sent by a student for their own plan', async () => {
    state.userId = 'student-user';
    const response = await archiveInstance(post({ instanceId: 'self-1', entitlementPolicy: 'no_charge', archiveReason: 'other' }));
    expect(response.status).toBe(200);
    expect(instanceWrites()[0].payload).toMatchObject({ status: 'archived', entitlement_consumption_policy: 'count_service', archive_reason: 'served_phase' });
  });

  it('keeps billing overrides available to the coach', async () => {
    const response = await archiveInstance(post({ instanceId: 'plan-1', entitlementPolicy: 'no_charge', archiveReason: 'replaced_no_charge' }));
    expect(response.status).toBe(200);
    expect(instanceWrites()[0].payload).toMatchObject({ entitlement_consumption_policy: 'no_charge', archive_reason: 'replaced_no_charge' });
  });
});

describe('activate-instance', () => {
  it('does not let a student reactivate a coach plan', async () => {
    state.userId = 'student-user';
    const response = await activateInstance(post({ instanceId: 'plan-1' }));
    expect(response.status).toBe(403);
    expect(instanceWrites()).toEqual([]);
  });
});

describe('complete-instance', () => {
  beforeEach(() => { vi.mocked(schedulePlanCompletionAutomation).mockClear(); });

  it('does not let a student finish their coach plan while a training day is still open', async () => {
    state.userId = 'student-user';
    const response = await completeInstance(post({ instanceId: 'plan-1' }));
    expect(response.status).toBe(409);
    expect(instanceWrites()).toEqual([]);
    expect(schedulePlanCompletionAutomation).not.toHaveBeenCalled();
  });

  it('lets the student finish once every training day is completed or skipped', async () => {
    state.userId = 'student-user';
    state.tables.plan_instance_executions.push({ id: 'e4', instance_id: 'plan-1', day_index: 5, status: 'completed' });
    const response = await completeInstance(post({ instanceId: 'plan-1' }));
    expect(response.status).toBe(200);
    expect(instanceWrites()[0].payload.status).toBe('completed');
    expect(schedulePlanCompletionAutomation).toHaveBeenCalledWith('plan-1');
  });

  it('still lets the coach close their plan early', async () => {
    const response = await completeInstance(post({ instanceId: 'plan-1' }));
    expect(response.status).toBe(200);
    expect(instanceWrites()[0].payload.status).toBe('completed');
  });

  it('still lets a student close a plan they created for themselves', async () => {
    state.userId = 'student-user';
    const response = await completeInstance(post({ instanceId: 'self-1' }));
    expect(response.status).toBe(200);
  });
});
