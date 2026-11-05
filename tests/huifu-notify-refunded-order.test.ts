import { beforeEach, describe, expect, it, vi } from 'vitest';

// 2026-11-05: Huifu retried the double charge's payment callback every few hours.
// Once the duplicate is refunded, such a retry must leave the order refunded.
type Row = Record<string, any>;
const db = vi.hoisted(() => ({ orders: [] as Row[], updates: 0 }));
const fulfill = vi.hoisted(() => vi.fn(async () => null));

vi.mock('@/lib/huifuMiniProgramPay', () => ({
  parseHuifuNotifyContent: (content: string) => JSON.parse(content),
}));
vi.mock('@/lib/huifuWebPayment', () => ({
  assertHuifuWebPaymentAmount: () => undefined,
  isHuifuWebPayment: () => false,
}));
vi.mock('@/app/api/payment/alipay/fulfillPaidOrder', () => ({ fulfillSubscriptionAndMaybeCreditWallet: fulfill }));
vi.mock('@/app/api/payment/alipay/contentPurchaseFulfillment', () => ({ fulfillContentPurchasePaid: vi.fn() }));
vi.mock('@/app/api/payment/studentMembershipFulfillment', () => ({ fulfillStudentMembershipOrderOnPaid: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => {
  const from = () => {
    const filters: Array<(row: Row) => boolean> = [];
    let patch: Row | null = null;
    const q: any = {
      select: () => q,
      eq: (c: string, v: unknown) => { filters.push((r) => r[c] === v); return q; },
      neq: (c: string, v: unknown) => { filters.push((r) => r[c] !== v); return q; },
      update: (p: Row) => { patch = p; return q; },
      single: () => q,
      maybeSingle: () => q,
      then: (resolve: any, reject: any) => {
        const matched = db.orders.filter((r) => filters.every((f) => f(r)));
        if (patch) {
          db.updates += 1;
          matched.forEach((r) => Object.assign(r, patch));
        }
        return Promise.resolve({ data: matched[0] ? { ...matched[0] } : null, error: null }).then(resolve, reject);
      },
    };
    return q;
  };
  return { serviceRoleSupabase: { from }, default: { from } };
});

import { POST } from '@/app/api/payment/wechat/notify/route';

const order = (status: string) => ({
  id: 'order-2', user_id: 'student-1', status, order_type: 'coach_subscription', payment_provider: 'wechat',
  total_amount: 29900, order_data: { subscriptionId: 'sub-1' },
});
const paidCallback = () => new Request('http://localhost/api/payment/wechat/notify', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ sign: 'signed', resp_data: JSON.stringify({ req_seq_id: 'order-2', trans_stat: 'S' }) }),
});

describe('Huifu payment callback for a refunded order', () => {
  beforeEach(() => {
    db.updates = 0;
    fulfill.mockClear();
  });

  it('acknowledges the retry and keeps the order refunded', async () => {
    db.orders = [order('refunded')];
    const res = await POST(paidCallback() as any);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('RECV_ORD_ID_order-2');
    expect(db.orders[0].status).toBe('refunded');
    expect(db.updates).toBe(0);
    expect(fulfill).not.toHaveBeenCalled();
  });

  it('still records a paid callback for an order that was not refunded', async () => {
    db.orders = [order('pending')];
    const res = await POST(paidCallback() as any);
    expect(res.status).toBe(200);
    expect(db.orders[0].status).toBe('paid');
    expect(fulfill).toHaveBeenCalledTimes(1);
  });
});
