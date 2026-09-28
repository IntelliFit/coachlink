import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  user: '20000000-0000-4000-8000-000000000001' as string | null,
  rows: {} as Record<string, any[]>, errors: {} as Record<string, any>, rpc: vi.fn(), access: vi.fn(), refresh: vi.fn(),
}));
vi.mock('@/lib/getApiUserId', () => ({ getApiUserId: async () => state.user }));
vi.mock('@/app/api/execution/_helpers/subscriptionAccess', () => ({ validateExecutionSubscriptionAccess: state.access }));
vi.mock('@/app/api/execution/updateEstimatedEndDate', () => ({ updateEstimatedEndDateForInstance: state.refresh }));
vi.mock('@/lib/supabaseClient', () => ({ serviceRoleSupabase: {
  rpc: state.rpc,
  from(table: string) {
    const filters: Array<[string, any]> = [];
    const result = (single: boolean) => {
      const rows = (state.rows[table] || []).filter(row => filters.every(([key, value]) => row[key] === value));
      return { data: single ? rows[0] || null : rows, error: state.errors[table] || null };
    };
    const query: any = { select: () => query, eq: (key: string, value: any) => { filters.push([key,value]); return query; },
      maybeSingle: async () => result(true), then: (resolve: any) => Promise.resolve(result(false)).then(resolve) };
    return query;
  },
} }));
import { POST } from '@/app/api/execution/record-completion/route';
const plan = '10000000-0000-4000-8000-000000000001';
const requestId = '30000000-0000-4000-8000-000000000001';
const executionId = '40000000-0000-4000-8000-000000000001';
const updated = '2026-09-10T08:00:00Z';
const call = (extra = {}) => POST(new Request('http://localhost/api/execution/record-completion', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ instanceId: plan, dayIndex: 1, performedOn: '2026-09-10', requestId, ...extra }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  state.user = '20000000-0000-4000-8000-000000000001';
  state.errors = {};
  state.rows = { coach_plan_instances: [{ id: plan, student_id: state.user, start_date: '2026-09-01', status: 'active',
    training_days: [{ dayIndex: 1, type: 'training' }, { dayIndex: 2, type: 'rest' }] }] };
  state.access.mockResolvedValue({ allowed: true });
  state.rpc.mockResolvedValue({ data: [{ id: executionId, status: 'completed', performed_on: '2026-09-10' }], error: null });
});
describe('explicit completion route boundary', () => {
  it('requires authentication', async () => { state.user = null; expect((await call()).status).toBe(401); expect(state.rpc).not.toHaveBeenCalled(); });
  it('requires owned plan', async () => { state.rows.coach_plan_instances[0].student_id = 'someone-else'; expect((await call()).status).toBe(403); });
  it.each([{ dayIndex: 1.5 }, { dayIndex: 2 }, { performedOn: '2099-01-01' }, { performedOn: '2026-08-31' },
    { performedOn: '2026-09-31' }, { executionId }])('rejects invalid or unversioned input %j', async extra => {
    expect((await call(extra)).status).toBe(400); expect(state.rpc).not.toHaveBeenCalled();
  });
  it('never treats a failed history read as empty history', async () => {
    state.errors.plan_instance_executions = { message: 'offline' };
    expect((await call()).status).toBe(503); expect(state.rpc).not.toHaveBeenCalled();
  });
  it('reports migration missing without attempting a write', async () => {
    state.errors.plan_execution_date_confirmations = { code: '42P01' };
    expect((await call()).status).toBe(503); expect(state.rpc).not.toHaveBeenCalled();
  });
  it('checks entitlement for a new completion', async () => {
    state.access.mockResolvedValue({ allowed: false, status: 403, message: 'no credit' });
    expect((await call()).status).toBe(403); expect(state.rpc).not.toHaveBeenCalled();
  });
  it('correcting an already completed date does not require more credits', async () => {
    state.rows.plan_instance_executions = [{ id: executionId, instance_id: plan, student_id: state.user, day_index: 1, status: 'completed', updated_at: updated }];
    expect((await call({ executionId, expectedUpdatedAt: updated })).status).toBe(200);
    expect(state.access).not.toHaveBeenCalled();
  });
  it('a lost final-credit response can be retried via the owned audit ledger', async () => {
    state.rows.plan_execution_date_confirmations = [{ request_id: requestId, student_id: state.user }];
    state.access.mockResolvedValue({ allowed: false, status: 403 });
    expect((await call()).status).toBe(200); expect(state.access).not.toHaveBeenCalled();
    expect(state.rpc).toHaveBeenCalledWith('record_plan_completion_date', expect.objectContaining({ p_request_id: requestId }));
  });
  it('forwards authenticated owner, confirmed date and version only (not client student or completion time)', async () => {
    expect((await call({ studentId: 'victim', completed_at: '2026-09-26' })).status).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith('record_plan_completion_date', {
      p_instance_id: plan, p_student_id: state.user, p_day_index: 1, p_performed_on: '2026-09-10',
      p_execution_id: null, p_expected_updated_at: null, p_request_id: requestId, p_start_execution_day: 1,
    });
  });
  it.each(['EXECUTION_WRITE_CONFLICT', 'OTHER_ATTEMPT_EXISTS', 'PREVIOUS_TRAINING_UNRESOLVED', 'REQUEST_ID_CONFLICT'])('returns conflict for %s', async message => {
    state.rpc.mockResolvedValue({ data: null, error: { message } });
    expect((await call()).status).toBe(409); expect(state.refresh).not.toHaveBeenCalled();
  });
});
