import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WECHAT_FREE_RELEASE, WECHAT_FREE_RELEASE_HEADER, WECHAT_FREE_RELEASE_ID,
  WECHAT_COACH_PURCHASE_ENABLED, WECHAT_COACH_PURCHASE_HEADER, WECHAT_COACH_PURCHASE_ID,
  isWechatCoachPurchasePath, isWechatPurchasePaused,
  wechatCoachPurchaseHeaders, wechatReleaseHeaders,
} from '@coachlink/core';

const mocks = vi.hoisted(() => ({ from: vi.fn(), auth: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({
  default: { from: mocks.from }, serviceRoleSupabase: { from: mocks.from },
}));
vi.mock('@/lib/getApiUserId', () => ({ getApiUserId: mocks.auth }));

function req(headers = { ...wechatReleaseHeaders(), ...wechatCoachPurchaseHeaders() }, body = 'not-json') {
  return new Request('http://localhost/api/test', { method: 'POST', headers, body });
}

describe('coach commerce is independent of free platform membership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue(null);
    mocks.from.mockImplementation(() => { throw new Error('Unexpected database operation'); });
  });

  it('keeps platform free while enabling only Huifu coach purchases', () => {
    expect(WECHAT_FREE_RELEASE).toBe(true);
    expect(WECHAT_COACH_PURCHASE_ENABLED).toBe(true);
    expect(wechatReleaseHeaders()).toEqual({ [WECHAT_FREE_RELEASE_HEADER]: WECHAT_FREE_RELEASE_ID });
    expect(wechatCoachPurchaseHeaders()).toEqual({ [WECHAT_COACH_PURCHASE_HEADER]: WECHAT_COACH_PURCHASE_ID });
    for (const path of ['/api/payment/wechat/coach/create', '/api/subscription/create-subscription', '/api/cart/add?test=1']) {
      expect(isWechatCoachPurchasePath(path)).toBe(true);
      expect(isWechatPurchasePaused(path)).toBe(false);
    }
  });

  it.each([
    '/api/payment/wechat/membership/create', '/api/membership/create-order',
    '/api/payment/wechat/test/create', '/api/payment/alipay/create', '/api/payment/alipay/guest/create',
    '/api/subscription/renew-subscription', '/api/knowledge/subscription',
    '/api/toolbox/motion-effects/create-upload-url', '/api/toolbox/motion-effects/jobs/id/order',
  ])('keeps %s paused in the new client', path => {
    expect(isWechatCoachPurchasePath(path)).toBe(false);
    expect(isWechatPurchasePaused(path)).toBe(true);
  });

  it('allows new coach capability but preserves the old free-client block', async () => {
    const { rejectWechatCoachPurchase, rejectWechatPurchase, isWechatFreeRequest } = await import('./wechatFreeRelease');
    expect(rejectWechatCoachPurchase(req(), { wechatOnly: true })).toBeNull();
    expect(await isWechatFreeRequest(req())).toBe(true);
    expect(rejectWechatCoachPurchase(req(wechatReleaseHeaders()))?.status).toBe(403);
    expect(rejectWechatCoachPurchase(req({ ...wechatReleaseHeaders(), [WECHAT_COACH_PURCHASE_HEADER]: 'wrong' }))?.status).toBe(403);
    expect(rejectWechatCoachPurchase(req({}), { wechatOnly: true })).toBeNull();
    // The public marker cannot open platform membership or XPay orders.
    expect(rejectWechatPurchase(req(), { wechatOnly: true })?.status).toBe(403);
  });

  it.each([
    ['coach order', () => import('@/app/api/payment/wechat/coach/create/route')],
    ['pending subscription', () => import('@/app/api/subscription/create-subscription/route')],
    ['cart add', () => import('@/app/api/cart/add/route')],
  ])('restores %s to normal authentication, not to unauthenticated writes', async (_name, load) => {
    const { POST } = await load();
    const response = await POST(req() as any);
    expect(response.status).toBe(401);
    expect(mocks.auth).toHaveBeenCalledOnce();
    expect(mocks.from).not.toHaveBeenCalled();
  }, 30_000);

  it.each([
    ['membership', () => import('@/app/api/payment/wechat/membership/create/route')],
    ['direct entitlement renewal', () => import('@/app/api/subscription/renew-subscription/route')],
    ['effects upload', () => import('@/app/api/toolbox/motion-effects/create-upload-url/route')],
  ])('cannot use coach capability to unlock %s', async (_name, load) => {
    const { POST } = await load();
    const response = await POST(req() as any);
    expect(response.status).toBe(403);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  }, 30_000);

  it.each(['active', 'waiting', undefined])('does not grant service with unpaid status %s', async status => {
    mocks.auth.mockResolvedValue('student-test');
    const { POST } = await import('@/app/api/subscription/create-subscription/route');
    const response = await POST(req(undefined, JSON.stringify({ coachId: 'coach-test', tier: 1, monthlyPrice: 10, status })) as any);
    expect(response.status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
