import { describe, expect, it, vi } from 'vitest';
import { runSubscriptionExpiryCheck } from '@/lib/subscriptionExpiryCheck';
import { findDoubleChargedCarriedDays } from '@/lib/subscriptionCarriedProgress';

type Row = Record<string, any>;

/** In-memory PostgREST stand-in that, like Supabase, returns at most `cap` rows per request. */
function cappedDb(
  tables: Record<string, Row[]>,
  options: { cap?: number; failTable?: string; beforeFirstWrite?: (tables: Record<string, Row[]>) => void } = {},
) {
  const cap = options.cap ?? 1000;
  const writes: Array<{ table: string; payload: Row; ids: unknown[] }> = [];
  let wrote = false;
  const from = (table: string) => {
    const filters: Array<(row: Row) => boolean> = [];
    let payload: Row | null = null;
    let returnsRows = false;
    const ids: unknown[] = [];
    const query: any = {
      select: () => { if (payload) returnsRows = true; return query; },
      order: () => query,
      eq: (column: string, value: unknown) => { filters.push((row) => row[column] === value); if (column === 'id') ids.push(value); return query; },
      in: (column: string, values: unknown[]) => { filters.push((row) => values.includes(row[column])); if (column === 'id') ids.push(...values); return query; },
      not: (column: string) => { filters.push((row) => row[column] !== null && row[column] !== undefined); return query; },
      gt: (column: string, value: any) => {
        filters.push((row) => (typeof value === 'number' ? Number(row[column]) > value : String(row[column]) > String(value)));
        return query;
      },
      update: (patch: Row) => { payload = patch; return query; },
      then: (resolve: any, reject: any) => {
        if (payload) {
          if (!wrote) { wrote = true; options.beforeFirstWrite?.(tables); }
          const matched = (tables[table] || []).filter((row) => filters.every((keep) => keep(row)));
          matched.forEach((row) => Object.assign(row, payload));
          writes.push({ table, payload, ids });
          return Promise.resolve({ data: returnsRows ? matched.map((row) => ({ ...row })) : null, error: null }).then(resolve, reject);
        }
        if (options.failTable === table) return Promise.resolve({ data: null, error: { message: 'database unavailable' } }).then(resolve, reject);
        const rows = (tables[table] || []).filter((row) => filters.every((keep) => keep(row)))
          .sort((left, right) => String(left.id).localeCompare(String(right.id))).slice(0, cap);
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
      },
    };
    return query;
  };
  return { client: { from }, writes };
}

const weekPlan = (weeks: number, perWeek: number) => Array.from({ length: weeks * 7 }, (_, index) => ({
  dayIndex: index + 1, type: index % 7 < perWeek ? 'training' : 'rest',
}));
const pad = (value: number, width: number) => String(value).padStart(width, '0');

describe('runSubscriptionExpiryCheck', () => {
  it('reads every completed workout even when there are more than 1000', async () => {
    const subscriptions: Row[] = [];
    const instances: Row[] = [];
    const executions: Row[] = [];
    const trainingDays = weekPlan(8, 3);
    const trainingIndexes = trainingDays.filter((day) => day.type === 'training').slice(0, 12).map((day) => day.dayIndex);
    for (let index = 0; index < 100; index += 1) {
      const sub = `sub-${pad(index, 3)}`;
      const inst = `inst-${pad(index, 3)}`;
      subscriptions.push({ id: sub, student_id: `student-${index}`, status: 'active', start_date: '2026-01-01T00:00:00Z', end_date: null, subscribed_weeks: 4 });
      instances.push({ id: inst, coach_subscription_id: sub, status: 'active', start_execution_day: 1, created_at: '2026-01-01T00:00:00Z', training_days: trainingDays });
      trainingIndexes.forEach((day_index) => executions.push({
        id: `exec-${pad(executions.length, 4)}`, instance_id: inst, day_index, status: 'completed', completed_at: '2026-01-27T00:00:00Z',
      }));
    }
    const db = cappedDb({ coach_subscriptions: subscriptions, coach_plan_instances: instances, plan_instance_executions: executions });

    const result = await runSubscriptionExpiryCheck({ db: db.client, now: new Date('2026-01-28T00:00:00Z') });

    expect(executions).toHaveLength(1200);
    expect(result).toMatchObject({ ok: true, expiredCount: 100, refreshedCount: 0 });
  });

  it('holds auto-cancel for review when the balance includes double-charged carried days', async () => {
    const days = weekPlan(3, 3);
    const db = cappedDb({
      coach_subscriptions: [{ id: 'sub-dc', student_id: 'student-dc', status: 'active', start_date: '2026-01-01T00:00:00Z', end_date: null, subscribed_weeks: 3 }],
      coach_plan_instances: [
        { id: 'v1', coach_subscription_id: 'sub-dc', status: 'archived', start_execution_day: 1, created_at: '2026-01-01T00:00:00Z', training_days: days, entitlement_consumption_policy: 'count_service' },
        { id: 'v2', coach_subscription_id: 'sub-dc', status: 'active', start_execution_day: 4, created_at: '2026-01-05T00:00:00Z', training_days: days, entitlement_consumption_policy: 'count_service' },
      ],
      plan_instance_executions: [
        ...[1, 2, 3].map((day_index) => ({ id: `e1-${day_index}`, instance_id: 'v1', day_index, status: 'completed', completed_at: '2026-01-03T00:00:00Z' })),
        ...[8, 9, 10].map((day_index) => ({ id: `e2-${day_index}`, instance_id: 'v2', day_index, status: 'completed', completed_at: '2026-01-10T00:00:00Z' })),
      ],
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await runSubscriptionExpiryCheck({ db: db.client, now: new Date('2026-02-20T00:00:00Z') });
      expect(result).toMatchObject({ ok: true, cancelledCount: 0, heldForReviewIds: ['sub-dc'] });
      expect(db.writes.some((write) => write.payload.status === 'cancelled')).toBe(false);
      expect(db.writes.some((write) => write.table === 'users')).toBe(false);
    } finally { warn.mockRestore(); }
  });

  it('still cancels a genuinely used-up subscription after the grace period', async () => {
    const db = cappedDb({
      coach_subscriptions: [{ id: 'sub-done', student_id: 'student-1', status: 'active', start_date: '2026-01-01T00:00:00Z', end_date: '2026-01-01T00:00:00Z', subscribed_weeks: 1 }],
      coach_plan_instances: [{ id: 'plan', coach_subscription_id: 'sub-done', status: 'active', start_execution_day: 1, created_at: '2026-01-01T00:00:00Z', training_days: weekPlan(4, 2) }],
      plan_instance_executions: [1, 2].map((day_index) => ({ id: `e-${day_index}`, instance_id: 'plan', day_index, status: 'completed', completed_at: '2026-01-01T00:00:00Z' })),
    });
    const result = await runSubscriptionExpiryCheck({ db: db.client, now: new Date('2026-01-30T00:00:00Z') });
    expect(result).toMatchObject({ ok: true, expiredCount: 1, cancelledCount: 1 });
    expect(db.writes.some((write) => write.table === 'coach_subscriptions' && write.payload.status === 'cancelled')).toBe(true);
    expect(db.writes.some((write) => write.table === 'users' && write.payload.invitation_coach_id === null)).toBe(true);
  });

  it('leaves a subscription renewed after it was read active and linked to its coach', async () => {
    const db = cappedDb({
      coach_subscriptions: [{ id: 'sub-renewed', student_id: 'student-1', status: 'active', start_date: '2026-01-01T00:00:00Z', end_date: '2026-01-01T00:00:00Z', subscribed_weeks: 1 }],
      coach_plan_instances: [{ id: 'plan', coach_subscription_id: 'sub-renewed', status: 'active', start_execution_day: 1, created_at: '2026-01-01T00:00:00Z', training_days: weekPlan(4, 2) }],
      plan_instance_executions: [1, 2].map((day_index) => ({ id: `e-${day_index}`, instance_id: 'plan', day_index, status: 'completed', completed_at: '2026-01-01T00:00:00Z' })),
      users: [{ id: 'student-1', invitation_coach_id: 'coach-1' }],
    }, { beforeFirstWrite: (tables) => { tables.coach_subscriptions[0].subscribed_weeks = 5; } });
    const result = await runSubscriptionExpiryCheck({ db: db.client, now: new Date('2026-01-30T00:00:00Z') });
    expect(result).toMatchObject({ ok: true, cancelledCount: 0 });
    expect(db.writes.some((write) => write.table === 'users')).toBe(false);
  });

  it.each(['coach_subscriptions', 'coach_plan_instances', 'plan_instance_executions'])(
    'writes nothing when %s cannot be read', async (failTable) => {
      const db = cappedDb({
        coach_subscriptions: [{ id: 'sub', status: 'active', start_date: '2026-01-01T00:00:00Z', subscribed_weeks: 1 }],
        coach_plan_instances: [{ id: 'plan', coach_subscription_id: 'sub', status: 'active', created_at: '2026-01-01T00:00:00Z', training_days: weekPlan(1, 1) }],
        plan_instance_executions: [{ id: 'e', instance_id: 'plan', day_index: 1, status: 'completed' }],
      }, { failTable });
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const result = await runSubscriptionExpiryCheck({ db: db.client, now: new Date('2026-01-30T00:00:00Z') });
        expect(result.ok).toBe(false);
        expect(db.writes).toEqual([]);
      } finally { error.mockRestore(); }
    });
});

describe('findDoubleChargedCarriedDays', () => {
  const days = weekPlan(2, 3);
  const instance = (id: string, created_at: string, start_execution_day: number, extra: Row = {}) =>
    ({ id, created_at, start_execution_day, status: 'archived', training_days: days, ...extra });
  const done = (instance_id: string, ...dayIndexes: number[]) => dayIndexes.map((day_index) => ({ instance_id, day_index, status: 'completed' }));

  it('flags carried days that an earlier chargeable version already completed', () => {
    expect(findDoubleChargedCarriedDays({
      instances: [instance('v1', '2026-01-01', 1), instance('v2', '2026-01-05', 4, { status: 'active' })],
      executions: done('v1', 1, 2, 3),
    })).toEqual([{ instanceId: 'v2', dayIndexes: [1, 2, 3] }]);
  });

  it('ignores genuine offline progress that no earlier version recorded', () => {
    expect(findDoubleChargedCarriedDays({ instances: [instance('v1', '2026-01-01', 4)], executions: [] })).toEqual([]);
  });

  it('flags the same offline days carried again by a later chargeable version', () => {
    expect(findDoubleChargedCarriedDays({
      instances: [instance('v1', '2026-01-01', 4), instance('v2', '2026-01-05', 4, { status: 'active' })],
      executions: done('v1', 8),
    })).toEqual([{ instanceId: 'v2', dayIndexes: [1, 2, 3] }]);
  });

  it('ignores earlier versions that are already marked no_charge', () => {
    expect(findDoubleChargedCarriedDays({
      instances: [instance('v1', '2026-01-01', 1, { entitlement_consumption_policy: 'no_charge' }), instance('v2', '2026-01-05', 4)],
      executions: done('v1', 1, 2, 3),
    })).toEqual([]);
  });
});
