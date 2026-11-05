import { beforeEach, describe, expect, it, vi } from 'vitest';

// The mock behaves like production PostgREST: an update carrying .or() fails with 42703.
type Row = Record<string, any>;
const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  beforeSubscriptionWrite: null as null | ((tables: Record<string, Row[]>) => void),
  updates: 0,
  touched: [] as string[],
}));

vi.mock('@/lib/supabaseClient', () => {
  const from = (table: string) => {
    db.touched.push(table);
    const filters: Array<(row: Row) => boolean> = [];
    let patch: Row | null = null;
    let usedOr = false;
    let single = false;
    const q: any = {
      select: () => q,
      limit: () => q,
      in: (c: string, values: unknown[]) => { filters.push((r) => values.includes(r[c])); return q; },
      eq: (c: string, v: unknown) => { filters.push((r) => r[c] === v); return q; },
      is: (c: string, v: unknown) => { filters.push((r) => (v === null ? r[c] === null || r[c] === undefined : r[c] === v)); return q; },
      or: () => { usedOr = true; return q; },
      update: (p: Row) => { patch = p; return q; },
      single: () => { single = true; return q; },
      maybeSingle: () => { single = true; return q; },
      then: (resolve: any, reject: any) => {
        const rows = (db.tables[table] ||= []);
        if (patch && usedOr) {
          return Promise.resolve({ data: null, error: { code: '42703', message: `column ${table}.x does not exist` } }).then(resolve, reject);
        }
        let data: any;
        if (patch) {
          db.updates += 1;
          if (table === 'coach_subscriptions' && db.beforeSubscriptionWrite) {
            const hook = db.beforeSubscriptionWrite; db.beforeSubscriptionWrite = null; hook(db.tables);
          }
          const matched = rows.filter((r) => filters.every((f) => f(r)));
          matched.forEach((r) => Object.assign(r, patch));
          data = single ? (matched[0] ? { ...matched[0] } : null) : matched.map((r) => ({ ...r }));
        } else {
          const matched = rows.filter((r) => filters.every((f) => f(r)));
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

import { fulfillSubscriptionAndMaybeCreditWallet, fulfillSubscriptionOnPaid } from '@/app/api/payment/alipay/fulfillPaidOrder';

const subscription = (extra: Row = {}) => ({
  id: 'sub-1', student_id: 'student-1', coach_id: 'coach-1', status: 'inactive', subscribed_weeks: 8,
  last_payment_order_id: null, payment_data: {}, start_date: null, ...extra,
});
const paidOrder = (id: string, extra: Row = {}) => ({
  id, user_id: 'student-1', order_type: 'coach_subscription', total_amount: 29900,
  order_data: { subscriptionId: 'sub-1', coachId: 'coach-1' }, ...extra,
});

describe('paid coach subscription activation', () => {
  beforeEach(() => {
    db.tables = { coach_subscriptions: [subscription()], coaches: [{ id: 'coach-1', user_id: 'coach-user' }] };
    db.beforeSubscriptionWrite = null;
    db.updates = 0;
    db.touched = [];
  });

  it('activates a first purchase (the 2026-11-05 case that stayed inactive)', async () => {
    await fulfillSubscriptionOnPaid(paidOrder('order-1'), 'order-1', 'student-1', 'wechat');
    const sub = db.tables.coach_subscriptions[0];
    expect(sub.status).toBe('active');
    expect(sub.last_payment_order_id).toBe('order-1');
    expect(sub.order_id).toBe('order-1');
    expect(sub.payment_method).toBe('platform_wechat');
  });

  it('applies the same payment only once', async () => {
    await fulfillSubscriptionOnPaid(paidOrder('order-1'), 'order-1', 'student-1', 'wechat');
    const updatesAfterFirst = db.updates;
    await fulfillSubscriptionOnPaid(paidOrder('order-1'), 'order-1', 'student-1', 'wechat');
    expect(db.updates).toBe(updatesAfterFirst);
  });

  it('adds renewal weeks once when another payment lands between read and write', async () => {
    db.tables.coach_subscriptions = [subscription({ status: 'active', last_payment_order_id: 'order-0' })];
    db.beforeSubscriptionWrite = (tables) => {
      Object.assign(tables.coach_subscriptions[0], { subscribed_weeks: 12, last_payment_order_id: 'other-renew' });
    };
    const renew = paidOrder('renew-1', { order_type: 'coach_subscription_renew', order_data: { subscriptionId: 'sub-1', coachId: 'coach-1', renewAdditionalWeeks: 4 } });
    await fulfillSubscriptionOnPaid(renew, 'renew-1', 'student-1', 'wechat');
    const sub = db.tables.coach_subscriptions[0];
    expect(sub.subscribed_weeks).toBe(16);
    expect(sub.last_payment_order_id).toBe('renew-1');
  });
});

// 2026-11-05: the second ¥299 charge kept arriving through Huifu callback retries
// after the first one was activated by hand. It is a refund case, not an activation.
describe('a duplicate first purchase on an activated subscription', () => {
  const activatedBy = (orderId: string, extra: Row = {}) => subscription({
    status: 'active', last_payment_order_id: orderId, order_id: orderId, payment_confirmed_at: '2026-11-05T14:00:00Z', ...extra,
  });

  beforeEach(() => {
    db.tables = { coach_subscriptions: [activatedBy('first')], coaches: [{ id: 'coach-1', user_id: 'coach-user' }] };
    db.beforeSubscriptionWrite = null;
    db.updates = 0;
    db.touched = [];
  });

  it('leaves the subscription on the payment that activated it', async () => {
    await expect(fulfillSubscriptionOnPaid(paidOrder('duplicate'), 'duplicate', 'student-1', 'wechat')).resolves.toBe('duplicate');
    expect(db.tables.coach_subscriptions[0]).toMatchObject({
      status: 'active', last_payment_order_id: 'first', order_id: 'first', payment_confirmed_at: '2026-11-05T14:00:00Z',
    });
    expect(db.updates).toBe(0);
  });

  it('treats the slower of two simultaneous first purchases as the duplicate', async () => {
    db.tables.coach_subscriptions = [subscription()];
    db.beforeSubscriptionWrite = (tables) => {
      Object.assign(tables.coach_subscriptions[0], { status: 'active', last_payment_order_id: 'first', order_id: 'first' });
    };
    await expect(fulfillSubscriptionOnPaid(paidOrder('second'), 'second', 'student-1', 'wechat')).resolves.toBe('duplicate');
    expect(db.tables.coach_subscriptions[0]).toMatchObject({ last_payment_order_id: 'first', order_id: 'first' });
  });

  it('never books a coach settlement or wallet income for it', async () => {
    await fulfillSubscriptionAndMaybeCreditWallet(paidOrder('duplicate'), 'student-1', 'wechat');
    expect(db.touched).not.toContain('coach_subscription_settlements');
    expect(db.touched).not.toContain('wallet_transactions');
  });

  it('still settles the payment that activated the subscription', async () => {
    db.tables.coach_subscriptions = [subscription()];
    await fulfillSubscriptionAndMaybeCreditWallet(paidOrder('first'), 'student-1', 'wechat');
    expect(db.tables.coach_subscriptions[0].last_payment_order_id).toBe('first');
    expect(db.touched).toContain('wallet_transactions');
  });

  it('still activates a new first purchase once the old subscription has ended', async () => {
    db.tables.coach_subscriptions = [activatedBy('old', { status: 'expired' })];
    await expect(fulfillSubscriptionOnPaid(paidOrder('again'), 'again', 'student-1', 'wechat')).resolves.toBe('applied');
    expect(db.tables.coach_subscriptions[0]).toMatchObject({ status: 'active', last_payment_order_id: 'again' });
  });

  it('still applies a renewal on an activated subscription', async () => {
    const renew = paidOrder('renew-1', { order_type: 'coach_subscription_renew', order_data: { subscriptionId: 'sub-1', coachId: 'coach-1', renewAdditionalWeeks: 4 } });
    await expect(fulfillSubscriptionOnPaid(renew, 'renew-1', 'student-1', 'wechat')).resolves.toBe('applied');
    expect(db.tables.coach_subscriptions[0]).toMatchObject({ subscribed_weeks: 12, last_payment_order_id: 'renew-1' });
  });
});
