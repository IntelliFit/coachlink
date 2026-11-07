import { describe, expect, it } from 'vitest';
import { classifyCoachRefundOrders, type RefundOrderRow } from '@/lib/coachRefundOrders';
import { canOfferCoachRefund, coachRefundConfirmText, coachRefundResult, coachRefundSheetItems } from '@coachlink/core/src/coachRefund';

// 2026-11-05: a student was charged twice for one subscription. The coach-side
// refund button only offered last_payment_order_id, i.e. the payment the
// subscription runs on, and always said the subscription was cancelled.
const COACH = 'coach-1';
const subscription = { id: 'sub-1', status: 'active', order_id: 'o-first', last_payment_order_id: 'o-first' };
const row = (id: string, extra: Partial<RefundOrderRow> = {}): RefundOrderRow => ({
  id,
  status: 'paid',
  total_amount: 29900,
  order_type: 'coach_subscription',
  payment_provider: 'wechat',
  created_at: '2026-11-05T14:00:00Z',
  order_data: { subscriptionId: 'sub-1', coachId: COACH },
  ...extra,
});

describe('classifyCoachRefundOrders', () => {
  it('lists the duplicate as refundable without cancelling, and the paid-for one as cancelling', () => {
    const orders = classifyCoachRefundOrders({
      coachId: COACH,
      subscription,
      orders: [row('o-first'), row('o-dup', { created_at: '2026-11-05T14:03:00Z' })],
    });
    expect(orders.map((o) => [o.id, o.role, o.cancelsSubscription])).toEqual([
      ['o-dup', 'duplicate', false],
      ['o-first', 'in_use', true],
    ]);
    expect(orders[0]).toMatchObject({ amountFen: 29900, paymentProvider: 'wechat' });
  });

  it('includes WeChat (Huifu) and Alipay orders but never WeChat virtual payment', () => {
    const orders = classifyCoachRefundOrders({
      coachId: COACH,
      subscription,
      orders: [
        row('o-first', { payment_provider: 'alipay', order_type: 'subscription' }),
        row('o-xpay', { payment_provider: 'wechat_xpay' }),
      ],
    });
    expect(orders.map((o) => o.id)).toEqual(['o-first']);
  });

  it('drops orders that are unpaid, of another subscription, of another coach, or not subscription payments', () => {
    const orders = classifyCoachRefundOrders({
      coachId: COACH,
      subscription,
      orders: [
        row('o-first'),
        row('o-refunded', { status: 'refunded' }),
        row('o-other-sub', { order_data: { subscriptionId: 'sub-2', coachId: COACH } }),
        row('o-other-coach', { order_data: { subscriptionId: 'sub-1', coachId: 'coach-2' } }),
        row('o-content', { order_type: 'content_purchase' }),
        row('o-zero', { total_amount: 0 }),
      ],
    });
    expect(orders.map((o) => o.id)).toEqual(['o-first']);
  });

  it('links orders by subscription_id or by the ids the subscription stores', () => {
    const orders = classifyCoachRefundOrders({
      coachId: COACH,
      subscription,
      orders: [
        row('o-first', { order_data: { coachId: COACH } }),
        row('o-snake', { order_data: { subscription_id: 'sub-1', coachId: COACH }, created_at: '2026-11-06T00:00:00Z' }),
      ],
    });
    expect(orders.map((o) => o.id)).toEqual(['o-snake', 'o-first']);
  });

  it('marks a renewal: refunding it cancels the subscription, as the refund route does', () => {
    const orders = classifyCoachRefundOrders({
      coachId: COACH,
      subscription: { ...subscription, last_payment_order_id: 'o-renew' },
      orders: [
        row('o-first'),
        row('o-renew', { order_type: 'coach_subscription_renew', created_at: '2026-12-01T00:00:00Z' }),
      ],
    });
    expect(orders.map((o) => [o.id, o.role, o.cancelsSubscription])).toEqual([
      ['o-renew', 'in_use', true],
      ['o-first', 'other', true],
    ]);
  });

  it('links Web orders through their coach_subscription_orders id, including a Web double charge', () => {
    const web = (id: string, created: string) => row(id, {
      payment_provider: 'alipay', order_type: 'subscription', created_at: created,
      order_data: { subscriptionOrderId: 'so-1', coachId: COACH },
    });
    const orders = classifyCoachRefundOrders({
      coachId: COACH,
      subscription,
      subscriptionOrderIds: ['so-1'],
      orders: [web('o-first', '2026-11-05T14:00:00Z'), web('o-dup', '2026-11-05T14:02:00Z'), row('o-unlinked', {
        order_data: { subscriptionOrderId: 'so-other', coachId: COACH },
      })],
    });
    // Web purchases can stack weeks, so the refund route cancels even for the second one; the list says so.
    expect(orders.map((o) => [o.id, o.role, o.cancelsSubscription])).toEqual([
      ['o-dup', 'other', true],
      ['o-first', 'in_use', true],
    ]);
  });

  it('does not call the only payment a duplicate when activation never recorded it', () => {
    const orders = classifyCoachRefundOrders({
      coachId: COACH,
      subscription: { ...subscription, status: 'inactive', last_payment_order_id: null },
      orders: [row('o-first')],
    });
    expect(orders.map((o) => [o.role, o.cancelsSubscription])).toEqual([['other', false]]);
  });

  it('falls back to order_id for subscriptions activated before last_payment_order_id existed', () => {
    const orders = classifyCoachRefundOrders({
      coachId: COACH,
      subscription: { ...subscription, last_payment_order_id: null },
      orders: [row('o-first')],
    });
    expect(orders.map((o) => [o.role, o.cancelsSubscription])).toEqual([['in_use', true]]);
  });
});

describe('canOfferCoachRefund', () => {
  it('offers refunds for platform WeChat payments as well as Alipay', () => {
    expect(canOfferCoachRefund({ payment_method: 'platform_wechat', last_payment_order_id: 'o1' })).toBe(true);
    expect(canOfferCoachRefund({ payment_method: 'platform_alipay', order_id: 'o2' })).toBe(true);
  });

  it('hides it without a platform order, or for offline subscriptions', () => {
    expect(canOfferCoachRefund({ payment_method: 'platform_wechat' })).toBe(false);
    expect(canOfferCoachRefund({ payment_method: 'offline', order_id: 'o2' })).toBe(false);
    expect(canOfferCoachRefund({ payment_method: 'manual', order_id: 'o2' })).toBe(false);
    expect(canOfferCoachRefund(null)).toBe(false);
  });
});

describe('coachRefundSheetItems (mini-program action sheet, max 6 items)', () => {
  it('shows up to 6 orders as they are', () => {
    expect(coachRefundSheetItems([1, 2, 3, 4, 5, 6])).toEqual({ choices: [1, 2, 3, 4, 5, 6], hasMore: false });
  });

  it('keeps the last slot to say older orders exist instead of dropping them silently', () => {
    expect(coachRefundSheetItems([1, 2, 3, 4, 5, 6, 7])).toEqual({ choices: [1, 2, 3, 4, 5], hasMore: true });
  });
});

describe('coach refund texts', () => {
  it('only reports a cancelled subscription when the server cancelled it', () => {
    expect(coachRefundResult('cancelled')).toEqual({ title: '退款成功，订阅已取消', subscriptionCancelled: true });
    expect(coachRefundResult('kept').subscriptionCancelled).toBe(false);
    expect(coachRefundResult('kept').title).toContain('订阅保持不变');
    expect(coachRefundResult('unknown').subscriptionCancelled).toBe(false);
    expect(coachRefundResult(undefined)).toEqual({ title: '退款成功', subscriptionCancelled: false });
  });

  it('confirm text states the amount and what happens to the subscription', () => {
    const dup = coachRefundConfirmText({ amountFen: 29900, role: 'duplicate', cancelsSubscription: false });
    expect(dup).toContain('¥299');
    expect(dup).toContain('重复扣款');
    expect(dup).toContain('订阅保持不变');
    const inUse = coachRefundConfirmText({ amountFen: 1990, role: 'in_use', cancelsSubscription: true });
    expect(inUse).toContain('¥19.90');
    expect(inUse).toContain('订阅会被取消');
  });
});
