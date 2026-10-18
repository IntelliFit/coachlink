import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;
const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  /** Runs once, right before the first coach_subscriptions update is applied. */
  beforeSubscriptionWrite: null as null | ((tables: Record<string, Row[]>) => void),
}));

vi.mock('@/lib/supabaseClient', () => {
  const from = (table: string) => {
    const filters: Array<(row: Row) => boolean> = [];
    let patch: Row | null = null;
    let insert: Row | null = null;
    let single = false;
    let limit: number | null = null;
    const orFilter = (expr: string) => (row: Row) => expr.split(',').some((part) => {
      const [column, op, ...rest] = part.split('.');
      const value = rest.join('.');
      if (op === 'is' && value === 'null') return row[column] === null || row[column] === undefined;
      if (op === 'neq') return row[column] !== null && row[column] !== undefined && String(row[column]) !== value;
      return false;
    });
    const q: any = {
      select: () => q, order: () => q,
      limit: (n: number) => { limit = n; return q; },
      eq: (c: string, v: unknown) => { filters.push((r) => r[c] === v); return q; },
      is: (c: string, v: unknown) => { filters.push((r) => (v === null ? r[c] === null || r[c] === undefined : r[c] === v)); return q; },
      or: (expr: string) => { filters.push(orFilter(expr)); return q; },
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
        } else if (patch) {
          if (table === 'coach_subscriptions' && db.beforeSubscriptionWrite) {
            const hook = db.beforeSubscriptionWrite; db.beforeSubscriptionWrite = null; hook(db.tables);
          }
          const matched = rows.filter((r) => filters.every((f) => f(r)));
          matched.forEach((r) => Object.assign(r, patch));
          data = single ? (matched[0] ? { ...matched[0] } : null) : matched.map((r) => ({ ...r }));
        } else {
          let matched = rows.filter((r) => filters.every((f) => f(r)));
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
vi.mock('@/lib/coachingAutomation', () => ({ onRenewalPaid: vi.fn(async () => ({ success: true })) }));
vi.mock('@/lib/chat', () => ({ sendSystemMessage: vi.fn(async () => true) }));
vi.mock('@/app/api/plan-lib/auto-match-plan/service', () => ({ autoMatchPlanForSubscription: vi.fn(async () => ({ success: false })) }));
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
const order = (id: string, extra: Row = {}) => ({
  id, student_id: 'student-1', coach_id: 'coach-1', order_type: 'renew', subscription_id: 'sub-1', status: 'pending_payment',
  purchased_weeks: 4, tier: 1, amount_fen: 10000, payment_method: 'platform_alipay', payment_data: {}, product_id: null, ...extra,
});
const weeks = () => db.tables.coach_subscriptions[0].subscribed_weeks;

beforeEach(() => {
  db.tables = { coach_subscriptions: [subscription()], coach_subscription_orders: [], coaches: [{ id: 'coach-1', user_id: 'coach-user' }] };
  db.beforeSubscriptionWrite = null;
});

describe('renewal weeks are added exactly once', () => {
  it('ignores a second callback for the same renewal order', async () => {
    db.tables.coach_subscription_orders.push(order('order-1'));
    await finalizeSubscriptionOrder({ orderId: 'order-1', confirmedBy: 'system' });
    db.tables.coach_subscription_orders[0].status = 'pending_payment';
    await finalizeSubscriptionOrder({ orderId: 'order-1', confirmedBy: 'system' });
    expect(weeks()).toBe(12);
  });

  it('keeps both renewals when another order lands between the read and the write', async () => {
    db.tables.coach_subscription_orders.push(order('order-1'));
    db.beforeSubscriptionWrite = (tables) => {
      const sub = tables.coach_subscriptions[0];
      sub.subscribed_weeks += 12;
      sub.payment_data = { applied_subscription_order_ids: ['order-other'] };
    };
    await finalizeSubscriptionOrder({ orderId: 'order-1', confirmedBy: 'system' });
    expect(weeks()).toBe(24);
    expect(db.tables.coach_subscriptions[0].payment_data.applied_subscription_order_ids).toEqual(['order-other', 'order-1']);
  });
});

describe('subscribing again', () => {
  it('adds to a running subscription instead of overwriting its remaining weeks', async () => {
    db.tables.coach_subscription_orders.push(order('order-new', { order_type: 'subscribe', subscription_id: null, purchased_weeks: 4 }));
    await finalizeSubscriptionOrder({ orderId: 'order-new', confirmedBy: 'system' });
    const sub = db.tables.coach_subscriptions[0];
    expect(db.tables.coach_subscriptions).toHaveLength(1);
    expect(sub.subscribed_weeks).toBe(12);
    expect(sub.start_date).toBe('2026-09-01T00:00:00Z');
  });

  it('starts a fresh period on an ended subscription', async () => {
    db.tables.coach_subscriptions = [subscription({ status: 'cancelled' })];
    db.tables.coach_subscription_orders.push(order('order-new', { order_type: 'subscribe', subscription_id: null, purchased_weeks: 4 }));
    await finalizeSubscriptionOrder({ orderId: 'order-new', confirmedBy: 'system' });
    const sub = db.tables.coach_subscriptions[0];
    expect(sub.subscribed_weeks).toBe(4);
    expect(sub.start_date).toBeNull();
    expect(sub.status).toBe('active');
  });
});

describe('legacy Alipay renewal callback', () => {
  const payment = { id: 'pay-1', order_type: 'subscription_renew', order_data: { subscriptionId: 'sub-1', coachId: 'coach-1', renewAdditionalWeeks: 4 } };

  it('adds the weeks once even when the callback repeats', async () => {
    await fulfillSubscriptionOnPaid(payment, 'pay-1', 'student-1');
    await fulfillSubscriptionOnPaid(payment, 'pay-1', 'student-1');
    expect(weeks()).toBe(12);
  });

  it('does not add twice when a concurrent callback already recorded this payment', async () => {
    db.beforeSubscriptionWrite = (tables) => {
      const sub = tables.coach_subscriptions[0];
      sub.subscribed_weeks = 12;
      sub.last_payment_order_id = 'pay-1';
    };
    await fulfillSubscriptionOnPaid(payment, 'pay-1', 'student-1');
    expect(weeks()).toBe(12);
  });
});
