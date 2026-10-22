import { describe, it, expect, vi, beforeEach } from 'vitest';

// 记录每次查询链上的过滤条件，用来断言非管理员只能查到自己的申请。
const { mockSupabase, calls, result } = vi.hoisted(() => {
    const calls: Array<[string, unknown, unknown]> = [];
    const result: { value: any } = { value: { data: null, error: null, count: 0 } };
    const chain: any = {};
    for (const name of ['from', 'select', 'range', 'order']) {
        chain[name] = vi.fn(() => chain);
    }
    chain.eq = vi.fn((column: string, value: unknown) => {
        calls.push(['eq', column, value]);
        return chain;
    });
    chain.in = vi.fn((column: string, value: unknown) => {
        calls.push(['in', column, value]);
        return chain;
    });
    chain.maybeSingle = vi.fn(async () => result.value);
    chain.then = (resolve: (v: any) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(result.value).then(resolve, reject);
    return { mockSupabase: chain, calls, result };
});

vi.mock('@/app/api/auth/[...nextauth]/auth', () => ({
    getServerSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
    getAuthUser: vi.fn(),
}));

vi.mock('@/lib/supabaseClient', () => ({
    default: mockSupabase,
    serviceRoleSupabase: mockSupabase,
}));

import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { getAuthUser } from '@/lib/auth';
import { POST as listApplications } from '@/app/api/coach/list-coach-applications/route';
import { POST as getApplication } from '@/app/api/coach/get-coach-application/route';

const request = (body: unknown) => ({ json: async () => body, headers: new Headers() }) as unknown as Request;

describe('coach application read access', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        calls.length = 0;
        result.value = { data: null, error: null, count: 0 };
        (getAuthUser as any).mockResolvedValue({ isAuthenticated: false });
    });

    describe('list-coach-applications', () => {
        it('rejects anonymous callers', async () => {
            (getServerSession as any).mockResolvedValue(null);
            const res = await listApplications(request({}));
            expect(res.status).toBe(401);
        });

        it('rejects logged-in non-admin users', async () => {
            (getServerSession as any).mockResolvedValue({ user: { id: 'student-1', is_admin: false } });
            const res = await listApplications(request({}));
            expect(res.status).toBe(403);
            expect(mockSupabase.from).not.toHaveBeenCalled();
        });

        it('lets admins list applications', async () => {
            (getServerSession as any).mockResolvedValue({ user: { id: 'admin-1', is_admin: true } });
            result.value = { data: [{ id: 'app-1' }], error: null, count: 1 };
            const res = await listApplications(request({ page: 1, limit: 10 }));
            const json = await res.json();
            expect(res.status).toBe(200);
            expect(json.data.applications).toEqual([{ id: 'app-1' }]);
            expect(json.data.pagination.total).toBe(1);
        });

        it('filters by several statuses when the admin picks more than one', async () => {
            (getServerSession as any).mockResolvedValue({ user: { id: 'admin-1', is_admin: true } });
            result.value = { data: [], error: null, count: 0 };
            await listApplications(request({ status: ['pending', 'needs_info'] }));
            expect(calls).toContainEqual(['in', 'status', ['pending', 'needs_info']]);
        });

        it('filters by a single status string', async () => {
            (getServerSession as any).mockResolvedValue({ user: { id: 'admin-1', is_admin: true } });
            result.value = { data: [], error: null, count: 0 };
            await listApplications(request({ status: 'pending' }));
            expect(calls).toContainEqual(['eq', 'status', 'pending']);
        });
    });

    describe('get-coach-application', () => {
        it('scopes a non-admin lookup by id to the caller', async () => {
            (getServerSession as any).mockResolvedValue({ user: { id: 'student-1', is_admin: false } });
            await getApplication(request({ id: 'someone-elses-app' }));
            expect(calls).toContainEqual(['eq', 'user_id', 'student-1']);
        });

        it('ignores a userId supplied by a non-admin', async () => {
            (getServerSession as any).mockResolvedValue({ user: { id: 'student-1', is_admin: false } });
            await getApplication(request({ userId: 'victim-user' }));
            expect(calls).toContainEqual(['eq', 'user_id', 'student-1']);
            expect(calls).not.toContainEqual(['eq', 'user_id', 'victim-user']);
        });

        it('scopes mini-program bearer callers the same way', async () => {
            (getServerSession as any).mockResolvedValue(null);
            (getAuthUser as any).mockResolvedValue({
                isAuthenticated: true,
                userId: 'student-2',
                user: { id: 'student-2', is_admin: false },
            });
            await getApplication(request({ id: 'someone-elses-app' }));
            expect(calls).toContainEqual(['eq', 'user_id', 'student-2']);
        });

        it('lets admins read any application by id', async () => {
            (getServerSession as any).mockResolvedValue({ user: { id: 'admin-1', is_admin: true } });
            result.value = { data: { id: 'app-9', user_id: 'coach-9' }, error: null };
            const res = await getApplication(request({ id: 'app-9' }));
            const json = await res.json();
            expect(json.data.application).toEqual({ id: 'app-9', user_id: 'coach-9' });
            expect(calls).toContainEqual(['eq', 'id', 'app-9']);
            expect(calls.some(([, column]) => column === 'user_id')).toBe(false);
        });

        it('returns the caller own application when no id is given', async () => {
            (getServerSession as any).mockResolvedValue({ user: { id: 'student-1', is_admin: false } });
            await getApplication(request({}));
            expect(calls).toContainEqual(['eq', 'user_id', 'student-1']);
        });
    });
});
