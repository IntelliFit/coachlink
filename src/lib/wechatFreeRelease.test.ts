import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WECHAT_FREE_RELEASE_HEADER, WECHAT_FREE_RELEASE_ID, isWechatNewPurchasePath } from '@coachlink/core';

const mocks = vi.hoisted(() => ({ headers: vi.fn(), from: vi.fn(), auth: vi.fn() }));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('@/lib/supabaseClient', () => ({
  default: { from: mocks.from }, serviceRoleSupabase: { from: mocks.from },
}));
vi.mock('@/lib/getApiUserId', () => ({ getApiUserId: mocks.auth }));

function req(free = true) {
  return new Request('http://localhost/api/test', {
    method: 'POST', headers: free ? { [WECHAT_FREE_RELEASE_HEADER]: WECHAT_FREE_RELEASE_ID } : {},
    // Deliberately invalid JSON: the guard must run even before body parsing.
    body: 'not-json',
  });
}

describe('wechat free release safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockImplementation(() => { throw new Error('Unexpected database operation'); });
    mocks.headers.mockResolvedValue(new Headers({ [WECHAT_FREE_RELEASE_HEADER]: WECHAT_FREE_RELEASE_ID }));
  });

  it('selects only the public free client policy, not unmarked Web/background callers', async () => {
    const { isWechatFreeRequest } = await import('./wechatFreeRelease');
    expect(await isWechatFreeRequest(req())).toBe(true);
    expect(await isWechatFreeRequest(req(false))).toBe(false);
    expect(await isWechatFreeRequest()).toBe(true);
    mocks.headers.mockRejectedValue(new Error('Outside request scope'));
    expect(await isWechatFreeRequest()).toBe(false);
  });

  it('blocks miniapp-specific payments without trusting a client marker', async () => {
    const { rejectWechatPurchase } = await import('./wechatFreeRelease');
    expect(rejectWechatPurchase(req(false), { wechatOnly: true })?.status).toBe(403);
    expect(rejectWechatPurchase(req(false))).toBeNull();
    expect(rejectWechatPurchase(req())?.status).toBe(403);
  });

  it.each([
    ['membership', () => import('@/app/api/payment/wechat/membership/create/route')],
    ['coach', () => import('@/app/api/payment/wechat/coach/create/route')],
    ['test payment', () => import('@/app/api/payment/wechat/test/create/route')],
    ['membership legacy', () => import('@/app/api/membership/create-order/route')],
    ['coach subscription', () => import('@/app/api/subscription/create-subscription/route')],
    ['coach renewal', () => import('@/app/api/subscription/renew-subscription/route')],
    ['cart', () => import('@/app/api/cart/add/route')],
    ['alipay', () => import('@/app/api/payment/alipay/create/route')],
    ['guest alipay', () => import('@/app/api/payment/alipay/guest/create/route')],
    ['motion upload', () => import('@/app/api/toolbox/motion-effects/create-upload-url/route')],
    ['knowledge subscription', () => import('@/app/api/knowledge/subscription/route')],
  ])('rejects %s before authentication, parsing or database writes', async (_name, load) => {
    const route = await load();
    const response = await route.POST(req() as any);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ success: false, code: 'WECHAT_FREE_RELEASE', data: null });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.auth).not.toHaveBeenCalled();
  }, 30_000);

  it('rejects a direct motion order before looking up a job', async () => {
    const { POST } = await import('@/app/api/toolbox/motion-effects/jobs/[id]/order/route');
    const response = await POST(req(), { params: Promise.resolve({ id: 'old-job' }) });
    expect(response.status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('does not block historical query, refund, notification, download or questionnaire updates', () => {
    for (const path of [
      '/api/payment/wechat/query', '/api/payment/wechat/xpay/notify',
      '/api/payment/wechat/notify', '/api/payment/alipay/refund',
      '/api/subscription/update-questionnaire', '/api/subscription/coach-subscriptions',
      '/api/toolbox/motion-effects/jobs/existing/download-url',
      '/api/toolbox/motion-effects/jobs/existing/enqueue',
      '/api/coach/wallet/huifu/withdraw',
    ]) expect(isWechatNewPurchasePath(path)).toBe(false);
    expect(isWechatNewPurchasePath('/api/payment/wechat/coach/create')).toBe(true);
    expect(isWechatNewPurchasePath('/api/toolbox/motion-effects/jobs/id/order')).toBe(true);
  });
});
