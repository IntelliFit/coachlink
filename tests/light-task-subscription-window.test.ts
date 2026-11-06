import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const s = vi.hoisted(() => ({
  rows: {} as Record<string, any[]>,
  updates: [] as Array<{ table: string; values: any; filters: Array<[string, string, any]> }>,
  windowCalls: [] as any[],
  access: vi.fn(),
  lifecycle: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getAuthUser: async () => ({ isAuthenticated: true, userId: 'student' }) }));
vi.mock('@/app/api/execution/_helpers/subscriptionAccess', () => ({ validateExecutionSubscriptionAccess: s.access }));
vi.mock('@/lib/planExecutionLifecycle', () => ({ expireAndActivatePendingPlanRevisions: s.lifecycle }));
vi.mock('@/app/api/student/get-current-1rm/route', () => ({ getCurrent1RMRecords: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => {
  const client = {
    rpc: vi.fn(),
    from(table: string) {
      const filters: Array<(r: any) => boolean> = [];
      const recorded: Array<[string, string, any]> = [];
      let updateValues: any = null;
      const result = (single = false) => {
        const data = (s.rows[table] || []).filter((r) => filters.every((f) => f(r)));
        return { data: single ? data[0] || null : data, error: null };
      };
      const q: any = {
        select: () => q,
        update: (values: any) => { updateValues = values; return q; },
        eq: (k: string, v: any) => { filters.push((r) => r[k] === v); recorded.push(['eq', k, v]); return q; },
        is: (k: string, v: any) => { filters.push((r) => (r[k] ?? null) === v); recorded.push(['is', k, v]); return q; },
        neq: (k: string, v: any) => { filters.push((r) => r[k] !== v); return q; },
        order: () => q,
        limit: () => q,
        single: async () => result(true),
        maybeSingle: async () => result(true),
        then: (resolve: any) => {
          if (updateValues) s.updates.push({ table, values: updateValues, filters: recorded });
          return Promise.resolve(result()).then(resolve);
        },
      };
      return q;
    },
  };
  return { default: client, serviceRoleSupabase: client };
});

import { startSubscriptionWindowIfNeeded } from '@/app/api/execution/_helpers/subscriptionWindow';

describe('startSubscriptionWindowIfNeeded', () => {
  beforeEach(() => {
    s.updates = [];
    s.rows = {
      coach_subscriptions: [{ id: 'sub', status: 'active', start_date: null }],
      coach_plan_instances: [{ id: 'plan' }],
    };
  });

  it('opens a closed window only while start_date is still empty', async () => {
    await startSubscriptionWindowIfNeeded({ subscriptionId: 'sub', instanceId: 'plan', dayIndex: 3, startedAt: '2026-11-06T02:00:00.000Z' });
    expect(s.updates).toHaveLength(1);
    expect(s.updates[0].table).toBe('coach_subscriptions');
    expect(s.updates[0].values.start_date).toBe('2026-11-06T02:00:00.000Z');
    expect(s.updates[0].filters).toContainEqual(['is', 'start_date', null]);
  });

  it('also anchors the plan when the first real start is day 1', async () => {
    await startSubscriptionWindowIfNeeded({ subscriptionId: 'sub', instanceId: 'plan', dayIndex: 1, startedAt: '2026-11-06T02:00:00.000Z' });
    expect(s.updates.map((u) => u.table)).toEqual(['coach_subscriptions', 'coach_plan_instances']);
    expect(s.updates[1].values.start_date).toBe('2026-11-06');
  });

  it('leaves an open window, an inactive subscription or no subscription alone', async () => {
    s.rows.coach_subscriptions[0].start_date = '2026-10-01T00:00:00.000Z';
    await startSubscriptionWindowIfNeeded({ subscriptionId: 'sub', instanceId: 'plan', dayIndex: 1, startedAt: 'x' });
    s.rows.coach_subscriptions[0] = { id: 'sub', status: 'pending_payment', start_date: null };
    await startSubscriptionWindowIfNeeded({ subscriptionId: 'sub', instanceId: 'plan', dayIndex: 1, startedAt: 'x' });
    await startSubscriptionWindowIfNeeded({ subscriptionId: null, instanceId: 'plan', dayIndex: 1, startedAt: 'x' });
    expect(s.updates).toHaveLength(0);
  });
});

describe('start route and light tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    s.updates = [];
    s.access.mockResolvedValue({ allowed: true });
    s.lifecycle.mockResolvedValue({ activations: [] });
    s.rows = {
      coach_subscriptions: [{ id: 'sub', student_id: 'student', status: 'active', start_date: null }],
      coach_plan_instances: [{ id: 'plan', student_id: 'student', coach_subscription_id: 'sub', start_execution_day: 1, start_date: null,
        training_days: [{ dayIndex: 1, type: 'training', actionSets: [{ action_id: 'pullup' }] }] }],
      // The day's execution already exists because the student added a diet light task first.
      plan_instance_executions: [{ id: 'day1', instance_id: 'plan', student_id: 'student', day_index: 1, status: 'in_progress',
        action_executions: [{ item_type: 'DIET' }] }],
    };
  });

  const start = async (purpose?: string) => {
    const { POST } = await import('@/app/api/execution/start/route');
    return POST(new NextRequest('http://localhost/api/execution/start', {
      method: 'POST', body: JSON.stringify({ instanceId: 'plan', dayIndex: 1, ...(purpose ? { purpose } : {}) }),
    }));
  };

  it('does not start the subscription when the student only ticks a light task', async () => {
    const response = await start('light_task');
    expect(response.status).toBe(200);
    expect(s.updates.filter((u) => u.table === 'coach_subscriptions')).toHaveLength(0);
  });

  it('starts it when the student opens the same day to really train', async () => {
    const response = await start();
    expect(response.status).toBe(200);
    expect((await response.json()).data.id).toBe('day1');
    const subscriptionUpdates = s.updates.filter((u) => u.table === 'coach_subscriptions');
    expect(subscriptionUpdates).toHaveLength(1);
    expect(subscriptionUpdates[0].values.start_date).toEqual(expect.any(String));
  });
});
