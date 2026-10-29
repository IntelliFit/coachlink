import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ fetch: vi.fn(), session: vi.fn(), rebuild: vi.fn(), after: vi.fn() }));

vi.mock('../../../auth/[...nextauth]/auth', () => ({ getServerSession: db.session }));
vi.mock('../contributorStats', () => ({ rebuildStreetliftingLocationContributorStats: db.rebuild }));
vi.mock('next/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/server')>()), after: db.after }));

// Exercise the installed PostgREST query builder without connecting to a database.
vi.mock('@/lib/supabaseClient', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    return {
        serviceRoleSupabase: createClient('http://delete.test', 'test-key', {
            global: { fetch: db.fetch },
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        }),
    };
});

import { POST } from './route';

function respond(data: unknown, headers: Record<string, string> = {}) {
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', ...headers } });
}

function request(body: unknown) {
    return new Request('http://localhost/api/streetlifting-index/locations/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function call(index: number) {
    const [url, init] = db.fetch.mock.calls[index];
    return { params: new URL(String(url)).searchParams, method: (init as RequestInit | undefined)?.method };
}

describe('uploader-only bar location delete', () => {
    beforeEach(() => {
        db.fetch.mockReset();
        db.session.mockReset();
        db.after.mockReset();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('rejects anonymous requests without touching the database', async () => {
        db.session.mockResolvedValue(null);

        const response = await POST(request({ id: 'loc-1' }));

        expect(response.status).toBe(401);
        expect(db.fetch).not.toHaveBeenCalled();
    });

    it('refuses to delete someone else\'s or an ownerless point', async () => {
        db.session.mockResolvedValue({ user: { id: 'user-1' } });
        db.fetch
            .mockResolvedValueOnce(respond({ id: 'loc-1', name: 'A', contributor_user_id: 'user-2' }))
            .mockResolvedValueOnce(respond({ id: 'loc-2', name: 'B', contributor_user_id: null }));

        expect((await POST(request({ id: 'loc-1' }))).status).toBe(403);
        expect((await POST(request({ id: 'loc-2' }))).status).toBe(403);
        expect(db.fetch).toHaveBeenCalledTimes(2);
        expect(db.fetch.mock.calls.every(([, init]) => (init as RequestInit | undefined)?.method !== 'DELETE')).toBe(true);
    });

    it('deletes the uploader\'s own point, scoped to their id, and rebuilds the leaderboard after responding', async () => {
        db.session.mockResolvedValue({ user: { id: 'user-1' } });
        db.fetch
            .mockResolvedValueOnce(respond({ id: 'loc-1', name: 'A', contributor_user_id: 'user-1' }))
            .mockResolvedValueOnce(respond(null, { 'Content-Range': '*/1' }));

        const response = await POST(request({ id: 'loc-1' }));
        const result = await response.json();

        expect(response.status).toBe(200);
        expect(result.data).toEqual({ id: 'loc-1' });
        expect(call(1).method).toBe('DELETE');
        expect(call(1).params.get('id')).toBe('eq.loc-1');
        expect(call(1).params.get('contributor_user_id')).toBe('eq.user-1');
        expect(db.after).toHaveBeenCalledTimes(1);
    });

    it('reports a missing point and a missing id', async () => {
        db.session.mockResolvedValue({ user: { id: 'user-1' } });
        db.fetch.mockResolvedValueOnce(respond(null));

        expect((await POST(request({ id: 'gone' }))).status).toBe(404);
        expect((await POST(request({}))).status).toBe(400);
    });
});
