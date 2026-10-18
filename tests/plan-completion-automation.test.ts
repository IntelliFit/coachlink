import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  policy: { nextPhaseMode: 'draft_notify' } as Record<string, string>,
  remainingWeeks: 3.6666,
  jobStatus: 'pending',
  jobOutput: null as Record<string, unknown> | null,
  messages: [] as Array<{ userId: string; content: string }>,
  marks: [] as Array<{ status: string; values: any }>,
  createdPlans: [] as any[],
  newerPlans: [] as any[],
  instance: { id: 'plan-1', coach_subscription_id: 'sub-1', coach_id: 'coach-1', student_id: 'student-1', status: 'completed', name: '力量八周' },
}));

vi.mock('@/lib/supabaseClient', () => {
  const query = (table: string) => {
    const rows: Record<string, unknown> = {
      user_profiles: { nickname: '小林' },
      coach_subscriptions: { id: 'sub-1', status: 'active', start_date: '2026-08-01', subscribed_weeks: 12 },
      coach_plan_instances: mocks.instance,
    };
    const chain: any = {
      select: () => chain, eq: () => chain, neq: () => chain, in: () => chain, gt: () => chain, update: () => chain,
      limit: async () => ({ data: table === 'coach_plan_instances' ? mocks.newerPlans : [], error: null }),
      maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
    };
    return chain;
  };
  return { serviceRoleSupabase: { from: query }, default: { from: query } };
});
vi.mock('@/lib/chat', () => ({
  sendSystemMessage: vi.fn(async (userId: string, message: { content: string }) => {
    mocks.messages.push({ userId, content: message.content });
    return true;
  }),
}));
vi.mock('@/lib/coachingAutomation/policy', () => ({
  resolveAutomationPolicy: async () => ({
    policy: mocks.policy,
    context: { subscriptionId: 'sub-1', coachId: 'coach-1', studentId: 'student-1', coachUserId: 'coach-user' },
  }),
}));
vi.mock('@/lib/coachingAutomation/jobs', () => ({
  createAutomationJob: async () => ({ id: 'job-1', status: mocks.jobStatus, output_snapshot: mocks.jobOutput }),
  isTerminalJob: (job: any) => ['succeeded', 'skipped', 'needs_coach_review'].includes(job?.status),
  markAutomationJob: async (_id: string, status: string, values: any = {}) => { mocks.marks.push({ status, values }); },
}));
vi.mock('@/lib/subscriptionBalance', () => ({
  loadSubscriptionBalance: async () => ({
    subscription: { id: 'sub-1', status: 'active', subscribed_weeks: 12 },
    state: { remainingServiceWeeks: mocks.remainingWeeks },
  }),
}));
vi.mock('@/app/api/plan-lib/create-ai-instance/service', () => ({
  createAiInstanceForSubscription: vi.fn(async (input: any) => {
    mocks.createdPlans.push(input);
    return { id: 'next-plan', name: '下一阶段' };
  }),
}));

import { onPlanProgressChanged } from '@/lib/coachingAutomation/nextPhase';
import { persistCompletedPlanInstanceIfNeeded, summarizePlanCompletion } from '@/lib/planInstanceCompletion';

const days = [{ dayIndex: 1, type: 'training' }, { dayIndex: 2, type: 'rest' }, { dayIndex: 3, type: 'training' }];
const done = (day_index: number) => ({ day_index, status: 'completed', completed_at: '2026-10-10T10:00:00Z' });

function fakeDb(result: { data: any; error: any }) {
  const calls: any[] = [];
  const chain: any = {
    update: (patch: any) => { calls.push(['update', patch]); return chain; },
    eq: (column: string, value: any) => { calls.push(['eq', column, value]); return chain; },
    select: () => chain,
    maybeSingle: async () => result,
  };
  return { calls, client: { from: (table: string) => { calls.push(['from', table]); return chain; } } };
}

describe('persistCompletedPlanInstanceIfNeeded', () => {
  const summary = summarizePlanCompletion({ trainingDays: days, executions: [done(1), done(3)] });
  const active = { id: 'plan-1', status: 'active', end_date: null };

  it('completes an active plan only through a conditional update and reports the transition once', async () => {
    const row = { ...active, status: 'completed', end_date: '2026-10-10' };
    const db = fakeDb({ data: row, error: null });
    const onCompleted = vi.fn();
    const result = await persistCompletedPlanInstanceIfNeeded({ supabase: db.client, instance: active, summary, onCompleted });
    expect(result).toEqual(row);
    expect(db.calls).toContainEqual(['eq', 'status', 'active']);
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(onCompleted).toHaveBeenCalledWith(row);
  });

  it('does not report a transition when another request already completed the plan', async () => {
    const db = fakeDb({ data: null, error: null });
    const onCompleted = vi.fn();
    const result = await persistCompletedPlanInstanceIfNeeded({ supabase: db.client, instance: active, summary, onCompleted });
    expect(result.status).toBe('completed');
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it('does not report a transition when the write fails', async () => {
    const db = fakeDb({ data: null, error: { message: 'timeout' } });
    const onCompleted = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await persistCompletedPlanInstanceIfNeeded({ supabase: db.client, instance: active, summary, onCompleted });
      expect(result.status).toBe('completed');
      expect(onCompleted).not.toHaveBeenCalled();
    } finally { warn.mockRestore(); }
  });

  it('leaves unfinished and already completed plans untouched', async () => {
    const db = fakeDb({ data: null, error: null });
    const onCompleted = vi.fn();
    const unfinished = summarizePlanCompletion({ trainingDays: days, executions: [done(1)] });
    await persistCompletedPlanInstanceIfNeeded({ supabase: db.client, instance: active, summary: unfinished, onCompleted });
    await persistCompletedPlanInstanceIfNeeded({ supabase: db.client, instance: { ...active, status: 'completed' }, summary, onCompleted });
    expect(db.calls).toEqual([]);
    expect(onCompleted).not.toHaveBeenCalled();
  });
});

describe('onPlanProgressChanged', () => {
  beforeEach(() => {
    mocks.policy = { nextPhaseMode: 'draft_notify' };
    mocks.remainingWeeks = 3.6666;
    mocks.jobStatus = 'pending';
    mocks.jobOutput = null;
    mocks.messages = [];
    mocks.marks = [];
    mocks.createdPlans = [];
    mocks.newerPlans = [];
  });

  it('reminds the coach with the student and remaining weeks instead of creating a hidden draft', async () => {
    const result = await onPlanProgressChanged('plan-1', 'plan_completed');
    expect(result.success).toBe(true);
    expect(mocks.createdPlans).toEqual([]);
    expect(mocks.messages).toHaveLength(1);
    expect(mocks.messages[0].userId).toBe('coach-user');
    expect(mocks.messages[0].content).toContain('小林');
    expect(mocks.messages[0].content).toContain('力量八周');
    expect(mocks.messages[0].content).toContain('3.7');
    expect(mocks.marks.at(-1)).toMatchObject({ status: 'succeeded', values: { outputSnapshot: { reason: 'coach_reminded' } } });
  });

  it('asks the coach to guide a renewal when the purchased weeks are used up', async () => {
    mocks.remainingWeeks = 0;
    const result = await onPlanProgressChanged('plan-1', 'plan_completed');
    expect(result.reason).toBe('insufficient_entitlement');
    expect(mocks.messages[0].content).toContain('小林');
    expect(mocks.messages[0].content).toContain('续费');
    expect(mocks.marks.at(-1)).toMatchObject({ status: 'skipped', values: { outputSnapshot: { reason: 'insufficient_entitlement' } } });
  });

  it('still publishes the next phase automatically for coaches who chose it', async () => {
    mocks.policy = { nextPhaseMode: 'auto_publish_if_credits' };
    await onPlanProgressChanged('plan-1', 'plan_completed');
    expect(mocks.createdPlans).toHaveLength(1);
    expect(mocks.createdPlans[0]).toMatchObject({ subscriptionId: 'sub-1', initialStatus: 'active' });
  });

  it('stays silent when the coach turned next-phase automation off', async () => {
    mocks.policy = { nextPhaseMode: 'off' };
    const result = await onPlanProgressChanged('plan-1', 'plan_completed');
    expect(result.reason).toBe('next_phase_mode_off');
    expect(mocks.messages).toEqual([]);
  });

  it('stays silent when the coach already arranged a newer plan', async () => {
    mocks.newerPlans = [{ id: 'plan-2' }];
    const result = await onPlanProgressChanged('plan-1', 'renewal_paid');
    expect(result.reason).toBe('next_phase_already_arranged');
    expect(mocks.messages).toEqual([]);
  });

  it('does not remind twice for the same completed plan', async () => {
    mocks.jobStatus = 'succeeded';
    await onPlanProgressChanged('plan-1', 'plan_completed');
    expect(mocks.messages).toEqual([]);
  });
});
