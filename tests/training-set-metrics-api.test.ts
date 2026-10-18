import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ row: null as any, auto: vi.fn(), writes: 0 }));
vi.mock('@/lib/getApiUserId', () => ({ getApiUserId: async () => 'student' }));
vi.mock('@/lib/planExecutionLifecycle', () => ({ PLAN_EXECUTION_HARD_TIMEOUT_MS: 5 * 60 * 60 * 1000, expireTimedOutPlanExecutions: async () => [], activatePendingPlanRevisionForSource: async () => ({ activated: false }) }));
vi.mock('@/app/api/execution/_helpers/subscriptionAccess', () => ({ validateExecutionSubscriptionAccess: async () => ({ allowed: true }) }));
vi.mock('@/app/api/execution/updateEstimatedEndDate', () => ({ updateEstimatedEndDateForInstance: async () => undefined }));
vi.mock('@/lib/autoE1rmTracking', () => ({ handleAutoE1RMCheck: state.auto }));
vi.mock('@/lib/workoutEnergyExecution', () => ({ attachWorkoutEnergyEstimate: async ({ actionExecutions }: any) => ({ actionExecutions, estimate: null }) }));
vi.mock('@/lib/supabaseClient', () => {
    const db = { from(table: string) {
        let patch: any;
        const exec = () => {
            if (table === 'coach_plan_instances') return { data: { coach_subscription_id: 'subscription' }, error: null };
            if (!['plan_instance_executions', 'impromptu_executions'].includes(table)) return { data: null, error: null };
            if (patch) { Object.assign(state.row, structuredClone(patch)); state.writes++; }
            return { data: structuredClone(state.row), error: null };
        };
        const q: any = { select: () => q, eq: () => q, is: () => q, gt: () => q, update: (p: any) => { patch = p; return q; },
            single: async () => exec(), maybeSingle: async () => exec(), then: (resolve: any, reject: any) => Promise.resolve(exec()).then(resolve, reject) };
        return q;
    } };
    return { default: db, serviceRoleSupabase: db };
});
import { POST as planComplete } from '@/app/api/execution/complete-set/route';
import { POST as impromptuComplete } from '@/app/api/impromptu/complete-set/route';
import { POST as planFinish } from '@/app/api/execution/finish/route';
import { POST as impromptuFinish } from '@/app/api/impromptu/finish/route';
import { POST as planAddSet } from '@/app/api/execution/extra-content/add-extra-set/route';
import { POST as impromptuAddSet } from '@/app/api/impromptu/extra-content/add-extra-set/route';

const hold = { set_number: 1, status: 'pending', planned_reps: '20秒', planned_target_type: 'time', planned_target_unit: 's', planned_rest_seconds: 90 };
function request(input: any) {
    return new Request('http://localhost/api/execution/complete-set', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ executionId: 'execution', actionIndex: 0, setIndex: 0, actionId: 'hold', ...input }) }) as never;
}
beforeEach(() => {
    state.writes = 0;
    state.auto.mockReset().mockResolvedValue(null);
    state.row = { id: 'execution', student_id: 'student', instance_id: 'plan', day_index: 1, status: 'in_progress', started_at: '2026-10-11T00:00:00.000Z', updated_at: '2026-10-11T00:00:00.000Z', completed_at: null, total_sets: 1, completed_sets: 0,
        action_executions: [{ action_id: 'hold', action_name: '面墙倒立', item_type: 'STRENGTH', sets: [structuredClone(hold)] }] };
});

describe.each([['plan', planComplete], ['impromptu', impromptuComplete]] as const)('%s timed strength endpoint', (_name, complete) => {
    it('persists seconds, notes and manual progress without kilograms, reps or automatic PR', async () => {
        const response = await complete(request({ actualDuration: 24, actualWeight: 50, actualReps: 20, notes: '保持稳定', is_pr: true, isPR: true }));
        expect(response.status).toBe(200);
        expect(state.row.action_executions[0].sets[0]).toMatchObject({ actual_duration: 24, actual_weight: null, actual_reps: null, e1rm: null, is_auto_pr: false, notes: '保持稳定', is_pr: true });
        expect(state.auto).not.toHaveBeenCalled();
    });
    it('rejects the old kilograms × reps request for a timed set before writing', async () => {
        const response = await complete(request({ actualWeight: 50, actualReps: 20 }));
        expect(response.status).toBe(400);
        expect(state.writes).toBe(0);
        expect(state.auto).not.toHaveBeenCalled();
    });
    it('saves zero external load for repetitions without treating zero as missing', async () => {
        state.row.action_executions[0].sets[0] = { set_number: 1, status: 'pending', planned_reps: '8' };
        const response = await complete(request({ actualWeight: 0, actualReps: 8 }));
        expect(response.status).toBe(200);
        expect(state.row.action_executions[0].sets[0]).toMatchObject({ actual_weight: 0, actual_reps: 8 });
    });
});

describe('timed sets through quick completion and adding sets', () => {
    it.each([planFinish, impromptuFinish])('quick completion copies the prescribed seconds without changing finished history', async finish => {
        const old = { ...hold, status: 'completed', actual_weight: 50, actual_reps: 20 };
        state.row.action_executions[0].sets.push(old);
        const response = await finish(request({ mode: 'quick' }));
        expect(response.status).toBe(200);
        expect(state.row.action_executions[0].sets[0]).toMatchObject({ actual_duration: 20, actual_weight: null, actual_reps: null });
        expect(state.row.action_executions[0].sets[1]).toEqual(old);
    });
    it.each([planAddSet, impromptuAddSet])('inherits time target instead of a corrupt old weight', async add => {
        state.row.action_executions[0].sets[0] = { ...hold, status: 'completed', actual_weight: 50, actual_reps: 20 };
        const response = await add(request({ weight: '50kg', reps: '20' }));
        expect(response.status).toBe(200);
        expect(state.row.action_executions[0].sets[1]).toMatchObject({ planned_weight: null, planned_reps: '20秒', planned_target_type: 'time', planned_target_unit: 's', planned_rest_seconds: 90 });
    });
});
