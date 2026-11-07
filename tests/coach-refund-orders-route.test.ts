import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;
const db = vi.hoisted(() => ({
  session: null as null | { user: { id: string } },
  tables: { coaches: [] as Row[], coach_subscriptions: [] as Row[], alipay_orders: [] as Row[] } as Record<string, Row[]>,
}));

vi.mock('@/app/api/auth/[...nextauth]/auth', () => ({ getServerSession: async () => db.session }));
vi.mock('@/lib/supabaseClient', () => {
  const from = (table: string) => {
    const filters: Array<(row: Row) => boolean> = [];
    let single = false;
    const q: any = {
      select: () => q,
      eq: (c: string, v: unknown) => { filters.push((r) => r[c] === v); return q; },
      in: (c: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[c])); return q; },
      order: () => q,
      limit: () => q,
      maybeSingle: () => { single = true; return q; },
      update: () => { throw new Error('the list route must not write'); },
      then: (resolve: any, reject: any) => {
        const rows = (db.tables[table] || []).filter((r) => filters.every((f) => f(r)));
        const data = single ? (rows[0] ?? null) : rows;
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return q;
  };
  return { serviceRoleSupabase: { from }, default: { from } };
});

import { POST } from '@/app/api/coach/subscription-refund-orders/route';

const call = (body: unknown) => POST(new Request('http://localhost/api/coach/subscription-refund-orders', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
}));

const order = (id: string, extra: Row = {}) => ({
  id, user_id: 'student-1', status: 'paid', total_amount: 29900, order_type: 'coach_subscription',
  payment_provider: 'wechat', created_at: '2026-11-05T14:00:00Z',
  order_data: { subscriptionId: 'sub-1', coachId: 'coach-1' }, ...extra,
});

describe('POST /api/coach/subscription-refund-orders', () => {
  beforeEach(() => {
    db.session = { user: { id: 'user-coach-1' } };
    db.tables = {
      coaches: [{ id: 'coach-1', user_id: 'user-coach-1' }, { id: 'coach-2', user_id: 'user-coach-2' }],
      coach_subscriptions: [{
        id: 'sub-1', coach_id: 'coach-1', student_id: 'student-1', status: 'active',
        order_id: 'o-first', last_payment_order_id: 'o-first',
      }],
      alipay_orders: [order('o-first'), order('o-dup', { created_at: '2026-11-05T14:03:00Z' })],
    };
  });

  it('lists a WeChat double charge: the duplicate keeps the subscription, the used one cancels it', async () => {
    const res = await call({ subscriptionId: 'sub-1' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.orders.map((o: Row) => [o.id, o.role, o.cancelsSubscription])).toEqual([
      ['o-dup', 'duplicate', false],
      ['o-first', 'in_use', true],
    ]);
  });

  it('keeps a duplicate as "kept" even when the applied order is not among the paid rows fetched', async () => {
    db.tables.alipay_orders = [
      order('o-dup', { created_at: '2026-11-05T14:03:00Z' }),
      // The applied order is fetched on its own; only its type matters here.
      order('o-first', { status: 'refunded' }),
    ];
    const body = await (await call({ subscriptionId: 'sub-1' })).json();
    expect(body.data.orders.map((o: Row) => [o.id, o.role, o.cancelsSubscription])).toEqual([['o-dup', 'duplicate', false]]);
  });

  it('lists a Web double charge linked only through coach_subscription_orders', async () => {
    db.tables.coach_subscription_orders = [{ id: 'so-1', subscription_id: 'sub-1' }, { id: 'so-9', subscription_id: 'sub-9' }];
    const web = (id: string, so: string, created: string) => order(id, {
      payment_provider: 'alipay', order_type: 'subscription', created_at: created,
      order_data: { subscriptionOrderId: so, coachId: 'coach-1' },
    });
    db.tables.alipay_orders = [
      web('o-first', 'so-1', '2026-11-05T14:00:00Z'),
      web('o-dup', 'so-1', '2026-11-05T14:02:00Z'),
      web('o-elsewhere', 'so-9', '2026-11-05T15:00:00Z'),
    ];
    const body = await (await call({ subscriptionId: 'sub-1' })).json();
    expect(body.data.orders.map((o: Row) => [o.id, o.cancelsSubscription])).toEqual([['o-dup', true], ['o-first', true]]);
  });

  it('refuses another coach\'s subscription', async () => {
    db.session = { user: { id: 'user-coach-2' } };
    const res = await call({ subscriptionId: 'sub-1' });
    expect(res.status).toBe(403);
    expect((await res.json()).data).toBeNull();
  });

  it('refuses a user who is not a coach, and an anonymous caller', async () => {
    db.session = { user: { id: 'user-student-1' } };
    expect((await call({ subscriptionId: 'sub-1' })).status).toBe(403);
    db.session = null;
    expect((await call({ subscriptionId: 'sub-1' })).status).toBe(401);
  });

  it('requires a subscription id', async () => {
    expect((await call({})).status).toBe(400);
  });
});
