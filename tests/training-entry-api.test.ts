import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const s = vi.hoisted(() => ({ auth: true, rows: {} as Record<string, any[]>, access: vi.fn(), lifecycle: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getAuthUser: async () => ({ isAuthenticated: s.auth, userId: s.auth ? 'student' : null }) }));
vi.mock('@/app/api/execution/_helpers/subscriptionAccess', () => ({ validateExecutionSubscriptionAccess: s.access }));
vi.mock('@/lib/planExecutionLifecycle', () => ({ expireAndActivatePendingPlanRevisions: s.lifecycle }));
vi.mock('@/app/api/student/get-current-1rm/route', () => ({ getCurrent1RMRecords: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => {
  const client = { rpc: s.rpc, from(table: string) {
    const filters: Array<(r: any) => boolean> = [];
    const result = (single = false) => { const data = (s.rows[table] || []).filter(r => filters.every(f => f(r))); return { data: single ? data[0] || null : data, error: null }; };
    const q: any = { select: () => q, eq: (k: string, v: any) => { filters.push(r => r[k] === v); return q; },
      neq: (k: string, v: any) => { filters.push(r => r[k] !== v); return q; }, order: () => q, limit: () => q,
      single: async () => result(true), maybeSingle: async () => result(true), then: (r: any) => Promise.resolve(result()).then(r) };
    return q;
  } };
  return { default: client, serviceRoleSupabase: client };
});
import { POST } from '@/app/api/execution/start/route';
const call = (dayIndex = 78) => POST(new NextRequest('http://localhost/api/execution/start', { method: 'POST', body: JSON.stringify({ instanceId: 'plan', dayIndex }) }));
beforeEach(() => {
  vi.clearAllMocks(); s.auth = true;
  s.access.mockResolvedValue({ allowed: true }); s.lifecycle.mockResolvedValue({ activations: [] });
  s.rows = { coach_plan_instances: [{ id: 'plan', student_id: 'student', start_execution_day: 76, start_date: new Date().toISOString(),
    training_days: [{ dayIndex: 76, type: 'rest' }, { dayIndex: 77, type: 'rest' }, { dayIndex: 78, type: 'training', actionSets: [{ action_id: 'pullup' }] }] }],
    plan_instance_executions: [{ id: 'active', instance_id: 'plan', student_id: 'student', day_index: 78, status: 'in_progress', completed_sets: 1 }] };
});
describe('start route uses shared sequence and preserves server permission checks', () => {
  it('rejects unauthenticated requests without lifecycle writes', async () => {
    s.auth = false; expect((await call()).status).toBe(401); expect(s.lifecycle).not.toHaveBeenCalled();
  });
  it('checks entitlement before any lifecycle mutation', async () => {
    s.access.mockResolvedValue({ allowed: false, status: 403, reason: 'PLAN_OUT_OF_SCOPE', message: '无权访问' });
    const response = await call(); expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('PLAN_OUT_OF_SCOPE'); expect(s.lifecycle).not.toHaveBeenCalled();
  });
  it('rejects fractional day indices', async () => { expect((await call(78.5)).status).toBe(400); });
  it('resumes D78 after two pure rest days without creating another execution', async () => {
    const response = await call(); expect(response.status).toBe(200); expect((await response.json()).data.id).toBe('active'); expect(s.rpc).not.toHaveBeenCalled();
  });
  it('does not return an active snapshot when an earlier task blocks sequence', async () => {
    s.rows.coach_plan_instances[0].training_days[1].action_sets = [{ action_id: 'diet' }];
    const response = await call(); expect(response.status).toBe(409); expect((await response.json()).code).toBe('TRAINING_DAY_NOT_CURRENT'); expect(s.rpc).not.toHaveBeenCalled();
  });
  it('returns meaningful timeout for explicit recovery, not a blank replacement', async () => {
    s.rows.plan_instance_executions[0].status = 'timed_out';
    const response = await call(); expect((await response.json()).data.status).toBe('timed_out'); expect(s.rpc).not.toHaveBeenCalled();
  });
  it('reports plan activation explicitly', async () => {
    s.lifecycle.mockResolvedValue({ activations: [{ activated: true }] });
    const response = await call(); expect(response.status).toBe(409); expect((await response.json()).code).toBe('PLAN_REVISION_ACTIVATED');
  });
  it('resumes a rest-day record with added tasks instead of calling it empty rest', async () => {
    s.rows.plan_instance_executions[0].day_index = 76;
    s.rows.plan_instance_executions[0].action_executions = [{ item_type: 'HABIT' }];
    const response = await call(76);
    expect(response.status).toBe(200); expect((await response.json()).data.id).toBe('active');
  });
});
