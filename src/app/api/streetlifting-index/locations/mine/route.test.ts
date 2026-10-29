import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ fetch: vi.fn(), session: vi.fn() }));

vi.mock('../../../auth/[...nextauth]/auth', () => ({ getServerSession: db.session }));

// Exercise the installed PostgREST query builder without connecting to a database.
vi.mock('@/lib/supabaseClient', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    return {
        serviceRoleSupabase: createClient('http://mine.test', 'test-key', {
            global: { fetch: db.fetch },
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        }),
    };
});

import { POST } from './route';

function respond(data: unknown, headers: Record<string, string> = {}) {
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', ...headers } });
}

function query(index: number) {
    return new URL(String(db.fetch.mock.calls[index][0])).searchParams;
}

const complete = {
    id: 'loc-1', name: '人民公园健身区', country: null, province: '上海', city: '上海市', county: '黄浦区',
    address: '南京西路231号', description: '单杠双杠都有，晚上有灯', image_url: null, image_urls: ['https://img/1.jpg', 'https://img/2.jpg'],
    latitude: 31.23, longitude: 121.47, equipment_types: ['pullup_bar'], created_at: '2026-10-20T00:00:00Z',
    contributor_user_id: 'user-1',
};
const bare = { ...complete, id: 'loc-2', name: '小区单杠', description: null, image_urls: null, latitude: null, longitude: null, equipment_types: null, created_at: '2026-10-21T00:00:00Z' };

describe('my uploaded bar locations', () => {
    beforeEach(() => {
        db.fetch.mockReset();
        db.session.mockReset();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('requires a session and never reads the database without one', async () => {
        db.session.mockResolvedValue(null);

        const response = await POST();

        expect(response.status).toBe(401);
        expect(db.fetch).not.toHaveBeenCalled();
    });

    it('returns only the session user\'s points with gaps, totals and leaderboard rank', async () => {
        db.session.mockResolvedValue({ user: { id: 'user-1' } });
        db.fetch
            .mockResolvedValueOnce(respond([bare, complete]))
            .mockResolvedValueOnce(respond({ contribution_score: 60 }))
            .mockResolvedValueOnce(respond(null, { 'Content-Range': '*/4' }));

        const result = await (await POST()).json();

        expect(query(0).get('contributor_user_id')).toBe('eq.user-1');
        expect(query(0).get('order')).toBe('created_at.desc,id.desc');
        expect(query(1).get('contributor_key')).toBe('eq.user:user-1');
        expect(query(2).get('contribution_score')).toBe('gt.60');
        expect(result.data.locations.map((item: { id: string }) => item.id)).toEqual(['loc-2', 'loc-1']);
        expect(result.data.locations[0].gaps).toEqual(['photo', 'equipment', 'position', 'description']);
        expect(result.data.locations[1].gaps).toEqual([]);
        expect(result.data.locations[1]).toMatchObject({ country: '中国', province: '上海市' });
        expect(result.data.summary).toEqual({ upload_count: 2, image_count_total: 2, needs_update_count: 1, contribution_score: 60, rank: 5 });
    });

    it('still lists points when the leaderboard has no row for the user yet', async () => {
        db.session.mockResolvedValue({ user: { id: 'user-2' } });
        db.fetch.mockResolvedValueOnce(respond([bare])).mockResolvedValueOnce(respond(null));

        const result = await (await POST()).json();

        expect(result.success).toBe(true);
        expect(result.data.summary).toMatchObject({ upload_count: 1, rank: null, contribution_score: null });
    });
});
