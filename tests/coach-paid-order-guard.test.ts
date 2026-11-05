import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;
const state = vi.hoisted(() => ({
  orders: [] as Row[],
  readError: null as null | { message: string },
  huifu: vi.fn(),
  fulfill: vi.fn(),
}));

vi.mock('@/lib/supabaseClient', () => {
  const from = (table: string) => {
    if (table !== 'alipay_orders') throw new Error(`unexpected table ${table}`);
    const filters: Array<(row: Row) => boolean> = [];
    let patch: Row | null = null;
    const q: any = {
      select: () => q, order: () => q, limit: () => q, gte: () => q, maybeSingle: () => q,
      eq: (c: string, v: unknown) => {
        filters.push((r) => (c === 'order_data->>subscriptionId' ? r.order_data?.subscriptionId === v : r[c] === v));
        return q;
      },
      in: (c: string, values: unknown[]) => { filters.push((r) => values.includes(r[c])); return q; },
      update: (p: Row) => { patch = p; return q; },
      then: (resolve: any, reject: any) => {
        if (state.readError && !patch) return Promise.resolve({ data: null, error: state.readError }).then(resolve, reject);
        const matched = state.orders.filter((r) => filters.every((f) => f(r)));
        if (patch) {
          matched.forEach((r) => Object.assign(r, patch));
          return Promise.resolve({ data: matched[0] ? { ...matched[0] } : null, error: null }).then(resolve, reject);
        }
        return Promise.resolve({ data: matched.map((r) => ({ ...r })), error: null }).then(resolve, reject);
      },
    };
    return q;
  };
  return { default: { from }, serviceRoleSupabase: { from } };
});
vi.mock('@/lib/huifuWebPayment', () => ({
  queryHuifuPaymentOrder: state.huifu,
  assertHuifuWebPaymentAmount: () => undefined,
}));
vi.mock('@/lib/huifuMiniProgramPay', () => ({ formatHuifuReqDate: () => '20261105' }));
vi.mock('@/app/api/payment/alipay/fulfillPaidOrder', () => ({ fulfillSubscriptionAndMaybeCreditWallet: state.fulfill }));

import { guardFirstPurchaseCheckout } from '@/app/api/payment/wechat/coach/create/paidOrderGuard';
import {
  ALREADY_SUBSCRIBED_MESSAGE, PAID_NOT_ACTIVATED_MESSAGE, PAID_PACKAGE_CHANGED_MESSAGE, PAYMENT_STATUS_UNKNOWN_MESSAGE,
} from '@/lib/coachCheckoutGuard';

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const order = (id: string, status: string, createdMinutesAgo: number, extra: Row = {}) => ({
  id, status, user_id: 'student-1', order_type: 'coach_subscription', total_amount: 29900,
  created_at: minutesAgo(createdMinutesAgo),
  order_data: { subscriptionId: 'sub-1', huifu_req_date: '20261105', productId: 'pkg-8w', durationMonths: 2 },
  ...extra,
});
// The row as it was on 2026-11-05: 8 weeks for ¥299, still inactive after two payments.
const inactive = {
  status: 'inactive', last_payment_order_id: null, payment_confirmed_at: null,
  monthly_price: 29900, product_id: 'pkg-8w', subscribed_weeks: 8,
};
const guard = (subscription: Row = inactive) => guardFirstPurchaseCheckout({ userId: 'student-1', subscriptionId: 'sub-1', subscription });

describe('first coach purchase never charges twice', () => {
  beforeEach(() => {
    state.orders = [];
    state.readError = null;
    state.huifu.mockReset();
    state.fulfill.mockReset();
    state.fulfill.mockResolvedValue(null);
  });

  it('lets a first purchase through when nothing was paid', async () => {
    state.orders = [order('cancelled-attempt', 'pending', 3)];
    state.huifu.mockResolvedValue({ trans_stat: 'P' });
    await expect(guard()).resolves.toEqual({ blocked: false });
  });

  it('refuses a first purchase on a running subscription', async () => {
    await expect(guard({ status: 'active', last_payment_order_id: 'paid-1' })).resolves.toMatchObject({ blocked: true, status: 409, message: ALREADY_SUBSCRIBED_MESSAGE });
    expect(state.huifu).not.toHaveBeenCalled();
  });

  it('blocks and retries activation when an earlier order is paid but not activated', async () => {
    state.orders = [order('first', 'paid', 21), order('other-subscription', 'paid', 5, { order_data: { subscriptionId: 'sub-2' } })];
    const result = await guard();
    expect(result).toEqual({ blocked: true, status: 409, message: PAID_NOT_ACTIVATED_MESSAGE, paidOrderId: 'first' });
    expect(state.fulfill).toHaveBeenCalledOnce();
    expect(state.fulfill.mock.calls[0][0].id).toBe('first');
  });

  it('does not activate a paid order after the student picked another package', async () => {
    state.orders = [order('first', 'paid', 21)];
    // Choosing the 12-week ¥799 package rewrote the row before this checkout.
    const result = await guard({ ...inactive, monthly_price: 79900, product_id: 'pkg-12w', subscribed_weeks: 12 });
    expect(result).toEqual({ blocked: true, status: 409, message: PAID_PACKAGE_CHANGED_MESSAGE, paidOrderId: 'first' });
    expect(state.fulfill).not.toHaveBeenCalled();
  });

  it('still blocks when the activation retry fails', async () => {
    state.orders = [order('first', 'paid', 21)];
    state.fulfill.mockRejectedValue(new Error('column coach_subscriptions.last_payment_order_id does not exist'));
    await expect(guard()).resolves.toMatchObject({ blocked: true, paidOrderId: 'first' });
  });

  it('asks Huifu about a recent pending order whose callback has not arrived', async () => {
    state.orders = [order('just-paid', 'pending', 1)];
    state.huifu.mockResolvedValue({ trans_stat: 'S', org_hf_seq_id: 'hf-1' });
    const result = await guard();
    expect(result).toMatchObject({ blocked: true, paidOrderId: 'just-paid' });
    expect(state.orders[0].status).toBe('paid');
    expect(state.fulfill).toHaveBeenCalledOnce();
  });

  it('does not block when the Huifu re-check fails', async () => {
    state.orders = [order('unknown', 'pending', 2)];
    state.huifu.mockRejectedValue(new Error('order not found'));
    await expect(guard()).resolves.toEqual({ blocked: false });
  });

  it('fails closed when earlier orders cannot be read', async () => {
    state.readError = { message: 'timeout' };
    await expect(guard()).resolves.toMatchObject({ blocked: true, status: 503, message: PAYMENT_STATUS_UNKNOWN_MESSAGE });
  });
});
