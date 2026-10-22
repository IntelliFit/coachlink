import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSupabase, inserted, accountPhone } = vi.hoisted(() => {
    const inserted: Array<Record<string, unknown>> = [];
    const accountPhone = { value: null as string | null };
    const chain: any = {};
    chain.from = vi.fn((table: string) => {
        chain._table = table;
        return chain;
    });
    chain.insert = vi.fn((row: Record<string, unknown>) => {
        inserted.push(row);
        return chain;
    });
    chain.select = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.single = vi.fn(async () => ({ data: { id: 'app-1', ...inserted[inserted.length - 1] }, error: null }));
    chain.maybeSingle = vi.fn(async () => ({ data: { phone: accountPhone.value }, error: null }));
    chain.then = (resolve: (v: any) => unknown) => Promise.resolve({ error: null }).then(resolve);
    return { mockSupabase: chain, inserted, accountPhone };
});

vi.mock('@/app/api/auth/[...nextauth]/auth', () => ({
    getServerSession: vi.fn(async () => ({ user: { id: 'user-1', is_admin: false } })),
}));
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ default: mockSupabase, serviceRoleSupabase: mockSupabase }));
vi.mock('@/lib/platformNotice', () => ({ notifyPlatformOwners: vi.fn(async () => 2) }));

import { POST as createApplication } from '@/app/api/coach/create-coach-application/route';

const request = (body: unknown) => ({ json: async () => body, headers: new Headers() }) as unknown as Request;
const baseBody = { name: '新教练', coachTrack: 'growth', city: '北京' };

describe('create-coach-application phone handling', () => {
    beforeEach(() => {
        inserted.length = 0;
        accountPhone.value = null;
    });

    it('rejects a malformed phone number', async () => {
        const res = await createApplication(request({ ...baseBody, contactPhone: '12345' }));
        expect(res.status).toBe(400);
        expect(inserted).toHaveLength(0);
    });

    it('stores a valid submitted phone', async () => {
        const res = await createApplication(request({ ...baseBody, contactPhone: '138 0000 0000' }));
        expect(res.status).toBe(200);
        expect(inserted[0].contact_phone).toBe('138 0000 0000');
    });

    it('falls back to the account phone when an old client sends none', async () => {
        accountPhone.value = '13900000000';
        const res = await createApplication(request({ ...baseBody, contactPhone: null }));
        expect(res.status).toBe(200);
        expect(inserted[0].contact_phone).toBe('13900000000');
    });

    it('still accepts the application when no phone is known at all', async () => {
        const res = await createApplication(request({ ...baseBody }));
        expect(res.status).toBe(200);
        expect(inserted[0].contact_phone).toBeNull();
    });
});
