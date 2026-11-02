import { beforeEach, describe, expect, it, vi } from 'vitest';

const { inserted, insertResult, skip } = vi.hoisted(() => ({
    inserted: [] as Array<Record<string, unknown>>,
    insertResult: { value: { error: null as null | { code?: string; message?: string } } },
    skip: { value: false },
}));

vi.mock('@/app/api/trace/trace-common', () => ({ shouldSkipTrace: () => skip.value }));
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({
    serviceRoleSupabase: {
        from: () => ({
            insert: async (row: Record<string, unknown>) => {
                inserted.push(row);
                return insertResult.value;
            },
        }),
    },
}));

import { POST } from '@/app/api/coach/funnel/route';
import { getAuthUser } from '@/lib/auth';
import {
    COACH_FUNNEL_RATE_LIMIT_PER_MINUTE,
    allowCoachFunnelEvent,
    resetCoachFunnelRateLimit,
    toCoachFunnelEventRow,
} from '@/lib/coachFunnelEvents';

const COACH_ID = '11111111-1111-4111-8111-111111111111';
const request = (body: unknown, ip = '1.1.1.1', forwarded = 'spoofed') =>
    ({ json: async () => body, headers: new Headers({ 'x-real-ip': ip, 'x-forwarded-for': forwarded }) }) as any;
const base = { event: 'profile_view', coachId: COACH_ID, platform: 'weapp', anonId: 'anon-1' };

describe('toCoachFunnelEventRow', () => {
    it('never trusts a user id from the request body', () => {
        const row = toCoachFunnelEventRow({ ...base, user_id: 'victim', userId: 'victim' }, null);
        expect(row?.user_id).toBeNull();
        expect(toCoachFunnelEventRow(base, 'real-user')?.user_id).toBe('real-user');
    });

    it.each([
        ['unknown event', { ...base, event: 'drop_table' }],
        ['unknown platform', { ...base, platform: 'ios' }],
        ['coach event without a coach', { ...base, coachId: undefined }],
        ['malformed coach id', { ...base, coachId: "1' OR 1=1" }],
        ['no way to identify the visitor', { ...base, anonId: '' }],
        ['exit reason with an unknown reason', { ...base, event: 'exit_reason', reason: 'nope' }],
        ['array body', [base]],
    ])('rejects %s', (_name, body) => {
        expect(toCoachFunnelEventRow(body, null)).toBeNull();
    });

    it('allows a list view without a coach', () => {
        expect(toCoachFunnelEventRow({ event: 'list_view', platform: 'web', anonId: 'a' }, null)?.coach_id).toBeNull();
    });

    it('keeps only allowed properties and caps their length', () => {
        const row = toCoachFunnelEventRow({
            ...base,
            event: 'buy_click',
            properties: { blocked: 'login_required', months: 2, phone: '13800000000', message: 'x'.repeat(200), nested: { a: 1 } },
        }, null);
        expect(row?.properties).toEqual({ blocked: 'login_required', months: 2, message: 'x'.repeat(64) });
    });

    it('trims the note, caps it at 200 characters, and only keeps it on an answer', () => {
        const row = toCoachFunnelEventRow({ ...base, event: 'exit_reason', reason: 'other', note: `  ${'字'.repeat(300)}  ` }, null);
        expect(row?.note).toHaveLength(200);
        expect(toCoachFunnelEventRow({ ...base, note: 'ignored', reason: 'price' }, null)).toMatchObject({ note: null, reason: null });
    });
});

describe('allowCoachFunnelEvent', () => {
    beforeEach(() => resetCoachFunnelRateLimit());

    it('blocks a client over the limit until the window passes', () => {
        const now = 1_000_000;
        for (let i = 0; i < COACH_FUNNEL_RATE_LIMIT_PER_MINUTE; i += 1) expect(allowCoachFunnelEvent('ip', now)).toBe(true);
        expect(allowCoachFunnelEvent('ip', now)).toBe(false);
        expect(allowCoachFunnelEvent('other-ip', now)).toBe(true);
        expect(allowCoachFunnelEvent('ip', now + 60_000)).toBe(true);
    });
});

describe('POST /api/coach/funnel', () => {
    beforeEach(() => {
        inserted.length = 0;
        insertResult.value = { error: null };
        skip.value = false;
        resetCoachFunnelRateLimit();
        (getAuthUser as any).mockResolvedValue({ isAuthenticated: false });
    });

    it('stores an anonymous view', async () => {
        const res = await POST(request(base));
        expect(res.status).toBe(200);
        expect(inserted[0]).toMatchObject({ event: 'profile_view', coach_id: COACH_ID, anon_id: 'anon-1', user_id: null });
    });

    it('takes the user from the session', async () => {
        (getAuthUser as any).mockResolvedValue({ isAuthenticated: true, userId: 'student-1' });
        await POST(request({ ...base, user_id: 'victim' }));
        expect(inserted[0].user_id).toBe('student-1');
    });

    it('writes nothing outside production', async () => {
        skip.value = true;
        const res = await POST(request(base));
        expect((await res.json()).data.ingested).toBe(0);
        expect(inserted).toHaveLength(0);
    });

    it('rejects invalid events', async () => {
        const res = await POST(request({ ...base, event: 'nope' }));
        expect(res.status).toBe(400);
        expect(inserted).toHaveLength(0);
    });

    it('rate limits one client, and rotating X-Forwarded-For does not get around it', async () => {
        for (let i = 0; i < COACH_FUNNEL_RATE_LIMIT_PER_MINUTE; i += 1) await POST(request(base, '1.1.1.1', `spoof-${i}`));
        const res = await POST(request(base, '1.1.1.1', 'spoof-new'));
        expect(res.status).toBe(429);
        expect(inserted).toHaveLength(COACH_FUNNEL_RATE_LIMIT_PER_MINUTE);
    });

    it('stays quiet while the migration has not run', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        insertResult.value = { error: { code: 'PGRST205', message: "Could not find the table in the schema cache" } };
        const res = await POST(request(base));
        expect(res.status).toBe(200);
        expect((await res.json()).data.ingested).toBe(0);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});
