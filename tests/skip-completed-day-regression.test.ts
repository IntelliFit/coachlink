import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ rows: [] as any[], historyError: null as any,
  writes: [] as any[], conflict: false, activated: vi.fn() }));
vi.mock('@/lib/getApiUserId', () => ({ getApiUserId: async () => 'student' }));
vi.mock('@/lib/planExecutionLifecycle', () => ({
  PLAN_EXECUTION_HARD_TIMEOUT_MS: 5 * 60 * 60 * 1000,
  activatePendingPlanRevisionForSource: state.activated,
}));
vi.mock('@/app/api/execution/_helpers/subscriptionAccess', () => ({
  validateExecutionSubscriptionAccess: async () => ({ allowed: true, maxAccessibleDayIndex: null }),
}));
vi.mock('@/lib/supabaseClient', () => ({ serviceRoleSupabase: {
  from(table: string) {
    let patch: any;
    const filters: any[] = [];
    const result = () => {
      if (table === 'coach_plan_instances') return { data: { id: 'plan', student_id: 'student',
        training_days: [{ dayIndex: 1, type: 'training' }] }, error: null };
      if (patch) { state.writes.push({ patch, filters }); return { data: state.conflict ? null : { id: 'attempt' }, error: null }; }
      return { data: state.rows, error: state.historyError };
    };
    const query: any = { select: () => query, order: () => query,
      eq: (key: string, value: any) => { filters.push([key, value]); return query; },
      gt: (key: string, value: any) => { filters.push([key, value]); return query; },
      update: (value: any) => { patch = value; return query; },
      insert: (value: any) => { patch = value; return query; },
      maybeSingle: async () => result(), then: (resolve: any) => Promise.resolve(result()).then(resolve),
    };
    return query;
  },
} }));
import { POST } from '@/app/api/execution/skip-day/route';
const call = (dayIndex = 1) => POST(new Request('http://localhost/api/execution/skip-day', {
  method: 'POST', body: JSON.stringify({ instanceId: 'plan', dayIndex }),
}));
beforeEach(() => { state.rows = []; state.historyError = null; state.writes = []; state.conflict = false; vi.clearAllMocks(); });
describe('skip preserves completion facts', () => {
  it('rejects a completed day even behind a newer empty attempt', async () => {
    state.rows = [{ id: 'new', status: 'in_progress' }, { id: 'old', status: 'completed' }];
    expect((await call()).status).toBe(409); expect(state.writes).toEqual([]);
  });
  it('does not insert a skip when reading history fails', async () => {
    state.historyError = { message: 'offline' };
    expect((await call()).status).toBe(503); expect(state.writes).toEqual([]);
  });
  it('a retry of an already skipped day preserves its original date', async () => {
    state.rows = [{ status: 'abandoned', completed_at: '2026-09-10' }];
    expect((await call()).status).toBe(200); expect(state.writes).toEqual([]);
  });
  it('does not treat a superseded attempt as a real skip', async () => {
    state.rows = [{ status: 'abandoned', close_reason: 'superseded_by_late_completion' }];
    expect((await call()).status).toBe(409); expect(state.writes).toEqual([]);
  });
  it('uses ownership, status and version conditions for an unfinished attempt', async () => {
    state.rows = [{ id: 'attempt', student_id: 'student', status: 'timed_out', updated_at: 'version' }];
    expect((await call()).status).toBe(200);
    expect(state.writes[0].filters).toEqual(expect.arrayContaining([
      ['id', 'attempt'], ['student_id', 'student'], ['status', 'timed_out'], ['updated_at', 'version'],
    ]));
  });
  it('a concurrent completion wins; skip returns a conflict', async () => {
    state.rows = [{ id: 'attempt', student_id: 'student', status: 'timed_out', updated_at: 'version' }];
    state.conflict = true;
    expect((await call()).status).toBe(409); expect(state.activated).not.toHaveBeenCalled();
  });
  it.each([1.5, Infinity, -1])('rejects invalid day %s before any write', async day => {
    expect((await call(day)).status).toBe(400); expect(state.writes).toEqual([]);
  });
});
