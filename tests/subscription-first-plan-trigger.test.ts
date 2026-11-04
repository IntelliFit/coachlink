import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]> }));
const automation = vi.hoisted(() => ({
  autoMatch: vi.fn(async () => ({ success: true })),
  onRenewalPaid: vi.fn(async () => ({ success: true })),
  sendSystemMessage: vi.fn(async () => true),
}));

vi.mock('@/lib/supabaseClient', () => {
  const from = (table: string) => {
    const filters: Array<(row: Row) => boolean> = [];
    let patch: Row | null = null;
    let insert: Row | null = null;
    let single = false;
    let limit: number | null = null;
    const q: any = {
      select: () => q, order: () => q,
      limit: (n: number) => { limit = n; return q; },
      eq: (c: string, v: unknown) => { filters.push((r) => r[c] === v); return q; },
      in: (c: string, v: unknown[]) => { filters.push((r) => v.includes(r[c])); return q; },
      is: (c: string, v: unknown) => { filters.push((r) => (v === null ? r[c] === null || r[c] === undefined : r[c] === v)); return q; },
      or: () => q,
      update: (p: Row) => { patch = p; return q; },
      insert: (p: Row) => { insert = p; return q; },
      single: () => { single = true; return q; },
      maybeSingle: () => { single = true; return q; },
      then: (resolve: any, reject: any) => {
        const rows = (db.tables[table] ||= []);
        let data: any;
        if (insert) {
          const row = { id: `${table}-${rows.length + 1}`, created_at: new Date().toISOString(), ...insert };
          rows.push(row);
          data = single ? { ...row } : [{ ...row }];
        } else {
          let matched = rows.filter((r) => filters.every((f) => f(r)));
          if (patch) matched.forEach((r) => Object.assign(r, patch));
          if (limit !== null) matched = matched.slice(0, limit);
          data = single ? (matched[0] ? { ...matched[0] } : null) : matched.map((r) => ({ ...r }));
        }
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return q;
  };
  const client = { from, rpc: async () => ({ data: null, error: null }) };
  return { default: client, serviceRoleSupabase: client };
});
vi.mock('@/lib/coachingAutomation', () => ({ onRenewalPaid: automation.onRenewalPaid }));
vi.mock('@/lib/chat', () => ({ sendSystemMessage: automation.sendSystemMessage }));
vi.mock('@/app/api/plan-lib/auto-match-plan/service', () => ({ autoMatchPlanForSubscription: automation.autoMatch }));
vi.mock('@/lib/subscriptionEntitlementSnapshot', () => ({ refreshSubscriptionEntitlementSnapshot: vi.fn(async () => null) }));
vi.mock('@/lib/subscriptionPackageQueue', () => ({
  applyPaidPackageRenewal: vi.fn(async () => null),
  activateQueuedPackageIfReady: vi.fn(async () => ({ activated: false })),
}));

import { finalizeSubscriptionOrder } from '@/lib/subscriptionOrders';
import { fulfillSubscriptionOnPaid } from '@/app/api/payment/alipay/fulfillPaidOrder';

const subscription = (extra: Row = {}) => ({
  id: 'sub-1', student_id: 'student-1', coach_id: 'coach-1', status: 'active', subscribed_weeks: 8,
  start_date: '2026-09-01T00:00:00Z', payment_data: {}, created_at: '2026-09-01T00:00:00Z', ...extra,
});
const subscribeOrder = (id: string) => ({
  id, student_id: 'student-1', coach_id: 'coach-1', order_type: 'subscribe', subscription_id: null, status: 'pending_payment',
  purchased_weeks: 4, tier: 1, amount_fen: 10000, payment_method: 'platform_alipay', payment_data: {}, product_id: null,
  subscribe_data: [{ type: 'option', question: '目标', userSelection: 0 }],
});
const messages = () => automation.sendSystemMessage.mock.calls.map((call: any[]) => String(call[1]?.content || ''));

beforeEach(() => {
  vi.clearAllMocks();
  db.tables = { coach_subscriptions: [], coach_subscription_orders: [], coaches: [{ id: 'coach-1', user_id: 'coach-user' }] };
});

describe('first plan trigger after a subscribe order is paid', () => {
  it('runs the first plan for a brand-new subscription, keyed by the order', async () => {
    db.tables.coach_subscription_orders.push(subscribeOrder('order-1'));

    await finalizeSubscriptionOrder({ orderId: 'order-1', confirmedBy: 'system' });

    const subId = db.tables.coach_subscriptions[0].id;
    expect(automation.autoMatch).toHaveBeenCalledTimes(1);
    expect(automation.autoMatch).toHaveBeenCalledWith(subId, 'coach-user', 'coach-1', { periodKey: 'order-1' });
    expect(automation.onRenewalPaid).not.toHaveBeenCalled();
  });

  it('gives a student who buys again after the old subscription ended a new first plan', async () => {
    // The row is reused, so without a per-order key the earlier succeeded job would block this one.
    db.tables.coach_subscriptions = [subscription({ status: 'cancelled' })];
    db.tables.coach_subscription_orders.push(subscribeOrder('order-2'));

    await finalizeSubscriptionOrder({ orderId: 'order-2', confirmedBy: 'system' });

    expect(automation.autoMatch).toHaveBeenCalledWith('sub-1', 'coach-user', 'coach-1', { periodKey: 'order-2' });
  });

  it('treats a purchase on a running subscription as a renewal', async () => {
    db.tables.coach_subscriptions = [subscription()];
    db.tables.coach_subscription_orders.push(subscribeOrder('order-3'));

    await finalizeSubscriptionOrder({ orderId: 'order-3', confirmedBy: 'system' });

    expect(automation.onRenewalPaid).toHaveBeenCalledWith('sub-1');
    expect(automation.autoMatch).not.toHaveBeenCalled();
  });

  it('leaves the plan result message to the automation', async () => {
    db.tables.coach_subscription_orders.push(subscribeOrder('order-4'));
    automation.autoMatch.mockResolvedValueOnce({ success: false, reason: 'plan_instance_exists' } as any);

    await finalizeSubscriptionOrder({ orderId: 'order-4', confirmedBy: 'system' });

    expect(messages().some((text) => text.includes('计划分配结果'))).toBe(false);
  });
});

describe('legacy platform payment for a subscription', () => {
  it('runs the first plan keyed by the payment and sends no separate result message', async () => {
    db.tables.coach_subscriptions = [subscription({ status: 'inactive', subscribed_weeks: 4, start_date: null })];
    const payment = { id: 'pay-1', order_type: 'subscription', order_data: { subscriptionId: 'sub-1', coachId: 'coach-1' } };

    await fulfillSubscriptionOnPaid(payment, 'pay-1', 'student-1');

    expect(db.tables.coach_subscriptions[0].status).toBe('active');
    expect(automation.autoMatch).toHaveBeenCalledWith('sub-1', 'coach-user', 'coach-1', { periodKey: 'pay-1' });
    expect(messages().some((text) => text.includes('计划分配结果'))).toBe(false);
  });
});
