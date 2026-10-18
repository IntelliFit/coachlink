import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    env: 1, userId: 'tester-7' as string | null,
    user: { id: 'tester-7', is_admin: false, wechat_openid: null as string | null },
    select: vi.fn(),
}));
vi.mock('@/lib/getApiUserId', () => ({ getApiUserId: async () => state.userId }));
vi.mock('@/lib/wechatXPay', () => ({ getWechatXPayConfig: () => ({ env: state.env }) }));
vi.mock('@/lib/supabaseClient', () => ({ serviceRoleSupabase: { from: () => {
    const chain: any = {
        select: (columns: string) => { state.select(columns); return chain },
        eq: () => chain,
        maybeSingle: async () => ({ data: state.user, error: null }),
    };
    return chain;
} } }));

import { requireXPayTrialUser } from '@/lib/wechatXPayAdminTrial';
const request = (token: string | null = 'real-login-jwt') => ({
    headers: new Headers(token ? { authorization: `Bearer ${token}` } : {}),
}) as any;

beforeEach(() => {
    vi.stubEnv('APOLLO_CLUSTER', 'dev');
    state.env = 1; state.userId = 'tester-7';
    state.user.is_admin = false; state.user.wechat_openid = null;
    state.select.mockClear();
});

describe('normal experience tester access', () => {
    it('admits a non-admin without requesting a tester allowlist or changing roles', async () => {
        expect(await requireXPayTrialUser(request())).toBe('tester-7');
        expect(state.user.is_admin).toBe(false);
        expect(state.select).toHaveBeenCalledOnce();
    });
    it('allows an unbound logged-in tester to enter before the native payment binding flow', async () => {
        expect(await requireXPayTrialUser(request())).toBe('tester-7');
        expect(state.user.wechat_openid).toBeNull();
    });
    it('continues to reject unauthenticated and local-debug identities', async () => {
        await expect(requireXPayTrialUser(request(null))).rejects.toThrow('登录');
        await expect(requireXPayTrialUser(request('cldev.fake'))).rejects.toThrow('登录');
        state.userId = null;
        await expect(requireXPayTrialUser(request())).rejects.toThrow('登录');
    });
    it('never opens the trial on main or with live credentials', async () => {
        state.env = 0;
        await expect(requireXPayTrialUser(request())).rejects.toThrow('沙箱');
        state.env = 1; vi.stubEnv('APOLLO_CLUSTER', 'main');
        await expect(requireXPayTrialUser(request())).rejects.toThrow('体验后端');
    });
});
