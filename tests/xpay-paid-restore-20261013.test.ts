import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), trial: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ serviceRoleSupabase: { rpc: mocks.rpc } }));
vi.mock('@/lib/wechatXPay', () => ({ getWechatXPayConfig: () => ({ env: 0 }) }));
vi.mock('@/lib/wechatXPayAdminTrial', () => ({ fulfillXPayAdminTrial: mocks.trial }));
import { fulfillPaidXPayOrder } from '@/app/api/payment/wechat/xpayOrder';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.clearAllMocks(); });
describe('paid experience recovery', () => {
  it('restores purchases only in the explicitly built / configured paid release', async () => {
    vi.stubEnv('COACHLINK_WECHAT_PAID_RELEASE', 'true');
    const policy = await import('../packages/core/src/wechatReleasePolicy');
    expect(policy.WECHAT_FREE_RELEASE).toBe(false);
    expect(policy.wechatReleaseHeaders()).toEqual({});
    expect(policy.WECHAT_COACH_PURCHASE_ENABLED).toBe(true);
    expect(policy.isWechatPurchasePaused('/api/payment/wechat/membership/create')).toBe(false);
  });
  it('stays free by default without a paid release opt-in', async () => {
    vi.stubEnv('COACHLINK_WECHAT_PAID_RELEASE', 'false');
    const policy = await import('../packages/core/src/wechatReleasePolicy');
    expect(policy.WECHAT_FREE_RELEASE).toBe(true);
    expect(policy.wechatReleaseHeaders()).toHaveProperty('x-coachlink-release','wechat-free-v1');
  });
  it('uses a single atomic transaction for ordinary membership delivery', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    await fulfillPaidXPayOrder({ id: 'payment-1', user_id: 'owner', order_type: 'student_membership', status: 'paid', order_data: {} });
    expect(mocks.rpc).toHaveBeenCalledWith('fulfill_wechat_xpay_membership', { p_payment_id: 'payment-1' });
    expect(mocks.trial).not.toHaveBeenCalled();
  });
  it('does not acknowledge delivery after a failed grant', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'transaction rolled back' } });
    await expect(fulfillPaidXPayOrder({ id:'payment-1', order_type:'student_membership', order_data:{} })).rejects.toThrow('rolled back');
  });
  it('preserves the already verified sandbox order handler', async () => {
    mocks.trial.mockResolvedValue(undefined);
    await fulfillPaidXPayOrder({ id:'sandbox-1', order_type:'student_membership', order_data:{ xpay_admin_trial:true } });
    expect(mocks.trial).toHaveBeenCalledOnce();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
