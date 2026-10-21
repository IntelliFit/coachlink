import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreetliftingLocationContributorItem } from './entity';

const db = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock('../../../auth/[...nextauth]/auth', () => ({
    getServerSession: vi.fn().mockResolvedValue(null),
}));

// Exercise the installed PostgREST query builder without connecting to a database.
vi.mock('@/lib/supabaseClient', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    return {
        serviceRoleSupabase: createClient('http://leaderboard.test', 'test-key', {
            global: { fetch: db.fetch },
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        }),
    };
});

import { POST } from './route';

function respond(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function contributor(index: number): StreetliftingLocationContributorItem {
    return {
        contributor_key: `user:${String(index).padStart(4, '0')}`,
        contributor_user_id: `user-${index}`,
        display_name: `贡献者 ${index}`,
        upload_count: 1,
        detail_score_total: 10,
        image_count_total: 1,
        contribution_score: 20,
        last_contributed_at: '2026-10-16T00:00:00.000Z',
    };
}

function request(body = {}) {
    return new Request('http://localhost/api/streetlifting-index/locations/contributors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function query(index: number) {
    return new URL(String(db.fetch.mock.calls[index][0])).searchParams;
}

describe('single-bar contributor leaderboard', () => {
    beforeEach(() => {
        db.fetch.mockReset();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns every contributor across database pages, with current names beyond the first page', async () => {
        const rows = Array.from({ length: 502 }, (_, index) => contributor(index));
        db.fetch
            .mockResolvedValueOnce(respond(rows.slice(0, 500)))
            .mockResolvedValueOnce(respond(rows.slice(500)))
            .mockResolvedValueOnce(respond([{ user_id: 'user-0', nickname: '当前昵称', full_name: '' }]))
            .mockResolvedValueOnce(respond([]))
            .mockResolvedValueOnce(respond([]))
            .mockResolvedValueOnce(respond([]))
            .mockResolvedValueOnce(respond([]))
            .mockResolvedValueOnce(respond([{ user_id: 'user-501', nickname: '', full_name: '当前姓名' }]));

        const response = await POST(request());
        const result = await response.json();

        expect(response.status).toBe(200);
        expect(result.data.contributors).toHaveLength(502);
        expect(result.data.contributors.map((row: StreetliftingLocationContributorItem) => row.contributor_key))
            .toEqual(rows.map(row => row.contributor_key));
        expect(result.data.contributors[0].display_name).toBe('当前昵称');
        expect(result.data.contributors[500].display_name).toBe('贡献者 500');
        expect(result.data.contributors[501].display_name).toBe('当前姓名');
        expect(query(0).get('contributor_key')).toBe('neq.legacy:anonymous');
        expect(query(0).get('order')).toBe('contribution_score.desc,upload_count.desc,detail_score_total.desc,last_contributed_at.desc,contributor_key.asc');
        expect(query(1).get('offset')).toBe('500');
        expect(query(2).get('user_id')?.split(',')).toHaveLength(100);
        expect(query(7).get('user_id')).toBe('in.(user-500,user-501)');
        expect(db.fetch).toHaveBeenCalledTimes(8);
    });

    it('stops after an empty final page when the total is an exact batch multiple', async () => {
        const rows = Array.from({ length: 500 }, (_, index) => ({ ...contributor(index), contributor_user_id: null }));
        db.fetch.mockResolvedValueOnce(respond(rows)).mockResolvedValueOnce(respond([]));

        const result = await (await POST(request())).json();

        expect(result.data.contributors).toHaveLength(500);
        expect(db.fetch).toHaveBeenCalledTimes(2);
    });

    it('keeps explicit top-N requests compatible with older clients', async () => {
        const rows = Array.from({ length: 10 }, (_, index) => ({ ...contributor(index), contributor_user_id: null }));
        db.fetch.mockResolvedValueOnce(respond(rows));

        const result = await (await POST(request({ limit: 10 }))).json();

        expect(result.data.contributors).toHaveLength(10);
        expect(query(0).get('limit')).toBe('10');
        expect(db.fetch).toHaveBeenCalledTimes(1);
    });

    it('returns an empty leaderboard without a profile query', async () => {
        db.fetch.mockResolvedValueOnce(respond([]));

        const result = await (await POST(request())).json();

        expect(result.data.contributors).toEqual([]);
        expect(db.fetch).toHaveBeenCalledTimes(1);
    });

    it('reports a later page failure instead of returning an incomplete leaderboard', async () => {
        db.fetch
            .mockResolvedValueOnce(respond(Array.from({ length: 500 }, (_, index) => contributor(index))))
            .mockResolvedValueOnce(respond({ message: 'page unavailable', code: 'XX000' }, 500));

        const response = await POST(request());
        const result = await response.json();

        expect(response.status).toBe(500);
        expect(result.success).toBe(false);
        expect(result.data).toBeNull();
        expect(db.fetch).toHaveBeenCalledTimes(2);
    });
});
