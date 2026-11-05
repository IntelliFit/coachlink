import { describe, expect, it } from 'vitest';
import {
  PAID_ORDER_LOOKBACK_MS,
  PENDING_RECHECK_LIMIT,
  PENDING_RECHECK_WINDOW_MS,
  findUnappliedPaidOrders,
  isRunningSubscription,
  paidOrderMatchesSubscription,
  selectPendingOrdersToRecheck,
} from '@/lib/coachCheckoutGuard';
import { shouldCancelSubscriptionOnRefund } from '@/lib/subscriptionRefund';

const NOW = Date.parse('2026-11-05T11:00:00Z');
const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();

describe('findUnappliedPaidOrders', () => {
  it('finds the double charge of 2026-11-05: two paid orders, subscription still inactive', () => {
    const orders = [
      { id: 'second', status: 'paid', created_at: at(18) },
      { id: 'first', status: 'paid', created_at: at(21) },
    ];
    const found = findUnappliedPaidOrders({ status: 'inactive', last_payment_order_id: null, payment_confirmed_at: null }, orders, NOW);
    expect(found.map((o) => o.id)).toEqual(['first', 'second']);
  });

  it('ignores the order the subscription already recorded', () => {
    const orders = [{ id: 'applied', status: 'paid', created_at: at(5) }];
    expect(findUnappliedPaidOrders({ status: 'inactive', last_payment_order_id: 'applied' }, orders, NOW)).toEqual([]);
  });

  it('ignores pending, failed and refunded orders', () => {
    const orders = ['pending', 'failed', 'refunded', 'closed'].map((status, i) => ({ id: `o${i}`, status, created_at: at(5) }));
    expect(findUnappliedPaidOrders({ status: 'inactive' }, orders, NOW)).toEqual([]);
  });

  it('only applies while the subscription is unpaid', () => {
    const orders = [{ id: 'x', status: 'paid', created_at: at(5) }];
    for (const status of ['active', 'near_expiry', 'expired', 'cancelled', 'waiting']) {
      expect(findUnappliedPaidOrders({ status }, orders, NOW)).toEqual([]);
    }
    expect(findUnappliedPaidOrders({ status: 'pending_payment' }, orders, NOW)).toHaveLength(1);
  });

  it('treats payments from before the last confirmed payment as an earlier period', () => {
    const orders = [
      { id: 'old', status: 'paid', created_at: at(120) },
      { id: 'new', status: 'paid', created_at: at(10) },
    ];
    const found = findUnappliedPaidOrders({ status: 'inactive', last_payment_order_id: 'other', payment_confirmed_at: at(60) }, orders, NOW);
    expect(found.map((o) => o.id)).toEqual(['new']);
  });

  it('ignores paid orders older than the lookback window', () => {
    const orders = [{ id: 'stale', status: 'paid', created_at: new Date(NOW - PAID_ORDER_LOOKBACK_MS - 1).toISOString() }];
    expect(findUnappliedPaidOrders({ status: 'inactive' }, orders, NOW)).toEqual([]);
  });
});

describe('selectPendingOrdersToRecheck', () => {
  it('re-checks only recent pending orders, newest first, capped', () => {
    const orders = [
      { id: 'too-old', status: 'pending', created_at: new Date(NOW - PENDING_RECHECK_WINDOW_MS - 1).toISOString() },
      { id: 'paid', status: 'paid', created_at: at(1) },
      ...Array.from({ length: PENDING_RECHECK_LIMIT + 2 }, (_, i) => ({ id: `p${i}`, status: 'pending', created_at: at(i + 1) })),
    ];
    const picked = selectPendingOrdersToRecheck(orders, NOW).map((o) => o.id);
    expect(picked).toEqual(['p0', 'p1', 'p2'].slice(0, PENDING_RECHECK_LIMIT));
  });
});

describe('paidOrderMatchesSubscription', () => {
  const paid = { id: 'a', status: 'paid', created_at: at(5), total_amount: 29900, order_data: { productId: 'pkg-8w', durationMonths: 2 } };
  const row = { status: 'inactive', monthly_price: 29900, product_id: 'pkg-8w', subscribed_weeks: 8 };

  it('matches the package the row still holds', () => {
    expect(paidOrderMatchesSubscription(paid, row)).toBe(true);
  });

  it('rejects a different price, product or length', () => {
    expect(paidOrderMatchesSubscription(paid, { ...row, monthly_price: 79900 })).toBe(false);
    expect(paidOrderMatchesSubscription(paid, { ...row, product_id: 'pkg-12w' })).toBe(false);
    expect(paidOrderMatchesSubscription(paid, { ...row, subscribed_weeks: 12 })).toBe(false);
  });

  it('rejects orders without a usable amount or length', () => {
    expect(paidOrderMatchesSubscription({ ...paid, total_amount: null }, row)).toBe(false);
    expect(paidOrderMatchesSubscription({ ...paid, order_data: { productId: 'pkg-8w' } }, row)).toBe(false);
    expect(paidOrderMatchesSubscription({ ...paid, order_data: null }, { ...row, product_id: null })).toBe(false);
  });
});

describe('isRunningSubscription', () => {
  it('blocks first purchases only while the subscription runs', () => {
    expect(isRunningSubscription('active')).toBe(true);
    expect(isRunningSubscription('near_expiry')).toBe(true);
    for (const status of ['inactive', 'expired', 'cancelled', 'waiting', null, undefined]) {
      expect(isRunningSubscription(status)).toBe(false);
    }
  });
});

describe('shouldCancelSubscriptionOnRefund', () => {
  const base = { id: 'sub-1' };

  it('cancels when the refunded first purchase is the one the subscription runs on', () => {
    expect(shouldCancelSubscriptionOnRefund({
      orderId: 'paid-1', orderType: 'coach_subscription',
      subscription: { ...base, status: 'active', order_id: 'paid-1', last_payment_order_id: 'paid-1' },
    })).toBe(true);
  });

  it('keeps the subscription when refunding a duplicate charge another first purchase activated', () => {
    expect(shouldCancelSubscriptionOnRefund({
      orderId: 'duplicate', orderType: 'coach_subscription', appliedOrderType: 'coach_subscription',
      subscription: { ...base, status: 'active', order_id: 'paid-1', last_payment_order_id: 'paid-1' },
    })).toBe(false);
  });

  it('still cancels when a renewal superseded the refunded first purchase', () => {
    expect(shouldCancelSubscriptionOnRefund({
      orderId: 'first', orderType: 'coach_subscription', appliedOrderType: 'coach_subscription_renew',
      subscription: { ...base, status: 'active', order_id: 'renew-1', last_payment_order_id: 'renew-1' },
    })).toBe(true);
  });

  it('still cancels when a Web purchase (which can stack weeks) is applied', () => {
    expect(shouldCancelSubscriptionOnRefund({
      orderId: 'weapp', orderType: 'coach_subscription', appliedOrderType: 'subscription',
      subscription: { ...base, status: 'active', order_id: 'web-1', last_payment_order_id: 'web-1' },
    })).toBe(true);
  });

  it('falls back to cancelling when the applied order type is unknown', () => {
    expect(shouldCancelSubscriptionOnRefund({
      orderId: 'first', orderType: 'coach_subscription',
      subscription: { ...base, status: 'active', order_id: 'x', last_payment_order_id: 'x' },
    })).toBe(true);
  });

  it('keeps an unactivated subscription that still points at the duplicate order', () => {
    expect(shouldCancelSubscriptionOnRefund({
      orderId: 'duplicate', orderType: 'coach_subscription',
      subscription: { ...base, status: 'inactive', order_id: 'duplicate', last_payment_order_id: null },
    })).toBe(false);
  });

  it('still cancels legacy rows activated before last_payment_order_id existed', () => {
    expect(shouldCancelSubscriptionOnRefund({
      orderId: 'legacy', orderType: 'subscription',
      subscription: { ...base, status: 'active', order_id: 'legacy', last_payment_order_id: null },
    })).toBe(true);
  });

  it('keeps the existing rule for renewal refunds', () => {
    expect(shouldCancelSubscriptionOnRefund({
      orderId: 'renew-1', orderType: 'coach_subscription_renew',
      subscription: { ...base, status: 'active', order_id: 'paid-1', last_payment_order_id: 'paid-1' },
    })).toBe(true);
  });
});
