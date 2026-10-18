import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ env: 1, userId: '7', user: { id: '7', is_admin: true, wechat_openid: 'wx-test' }, grantCalls: 0, balance: 12, orderData: null as any }));
vi.mock('@/lib/getApiUserId', () => ({ getApiUserId: async () => mock.userId }));
vi.mock('@/lib/wechatXPay', () => ({ getWechatXPayConfig: () => ({ env: mock.env }) }));
vi.mock('@/lib/supabaseClient', () => ({ serviceRoleSupabase: { from: (table: string) => {
  let patch: any;
  let expected: number | undefined;
  const chain: any = {
    select: () => chain, eq: (key: string, value: any) => { if (key === 'ai_import_balance') expected = value; return chain },
    update: (value: any) => { patch = value; return chain }, upsert: () => chain,
    maybeSingle: async () => ({ data: mock.user, error: null }),
    single: async () => ({ data: { ai_import_balance: mock.balance }, error: null }),
    then: (resolve: any) => {
      if (table === 'student_quotas' && patch && mock.balance === expected) { mock.balance = patch.ai_import_balance; mock.grantCalls++ }
      if (table === 'alipay_orders' && patch) mock.orderData = patch.order_data;
      return Promise.resolve({ error: null }).then(resolve);
    },
  };
  return chain;
} } }));
import { requireXPayTrialAdmin, fulfillXPayAdminTrial } from '@/lib/wechatXPayAdminTrial';
const request = (token = 'jwt-real') => ({ headers: new Headers({ authorization: `Bearer ${token}` }) }) as any;
beforeEach(() => { vi.stubEnv('APOLLO_CLUSTER', 'dev'); mock.env = 1; mock.user.is_admin = true; mock.balance = 12; mock.grantCalls = 0; mock.orderData = null });
describe('admin-only complete trial', () => {
  it('permits an authenticated bound administrator only on sandbox dev', async () => {
    expect(await requireXPayTrialAdmin(request())).toBe('7');
    mock.env = 0; await expect(requireXPayTrialAdmin(request())).rejects.toThrow('沙箱');
    mock.env = 1; vi.stubEnv('APOLLO_CLUSTER', 'main'); await expect(requireXPayTrialAdmin(request())).rejects.toThrow('体验');
  });
  it('rejects local-debug tokens and non-admins', async () => {
    await expect(requireXPayTrialAdmin(request('cldev.7'))).rejects.toThrow('微信');
    mock.user.is_admin = false; await expect(requireXPayTrialAdmin(request())).rejects.toThrow('管理员');
  });
  it('grants exactly three and recovers a repeated pre-marker request without adding again', async () => {
    const order = { id: 'a', user_id: '7', status: 'paid', order_data: { product_key: 'ai_pack_basic', xpay_env: 1, xpay_trial_balance_before: 12, related_order_id: 'b' } };
    await fulfillXPayAdminTrial(order); await fulfillXPayAdminTrial(order);
    expect(mock.balance).toBe(15); expect(mock.grantCalls).toBe(1); expect(mock.orderData.xpay_trial_granted_at).toBeTruthy();
  });
  it('does not acknowledge unpaid, mismatched or changed balances', async () => {
    const order = { id: 'a', user_id: '7', status: 'paid', order_data: { product_key: 'ai_pack_basic', xpay_env: 1, xpay_trial_balance_before: 10 } };
    await expect(fulfillXPayAdminTrial({ ...order, status: 'pending' })).rejects.toThrow('不匹配');
    await expect(fulfillXPayAdminTrial(order)).rejects.toThrow('发生变化');
    expect(mock.grantCalls).toBe(0); expect(mock.orderData).toBeNull();
  });
});
