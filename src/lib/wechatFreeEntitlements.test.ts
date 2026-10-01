import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ free: true, tables: [] as string[], updates: [] as any[] }));
vi.mock('@/lib/wechatFreeRelease', () => ({ isWechatFreeRequest: async () => mocks.free }));
vi.mock('@/lib/supabaseClient', () => ({
  serviceRoleSupabase: {
    from: (table: string) => {
      mocks.tables.push(table);
      const data = table === 'student_quotas'
        ? { user_id: 'u', storage_total_mb: 200, storage_used_mb: 300, ai_import_balance: 4 }
        : table === 'student_memberships' ? { tier: 'free' } : null;
      const query: any = {
        select: () => query, eq: () => query, limit: () => query,
        update: (patch: any) => { mocks.updates.push(patch); return query; },
        maybeSingle: async () => ({ data, error: null }),
      };
      return query;
    },
  },
}));
import { applyWechatFreePowerEntitlements, buildPowerAnalysisEntitlements } from './powerAnalysisEntitlements';
import { checkStorageAvailable } from './membershipLimit';

describe('free entitlements do not pollute paid records', () => {
  it('opens original quality with limits, without pretending the user is premium', () => {
    const actual = buildPowerAnalysisEntitlements('free');
    const free = applyWechatFreePowerEntitlements(actual, true);
    expect(actual.canUseOriginalQuality).toBe(false);
    expect(free).toMatchObject({ tier: 'free', canUseOriginalQuality: true, maxVideoSizeMb: 200, maxDurationSeconds: 60, dailyLimit: 20 });
    expect(applyWechatFreePowerEntitlements(actual, false)).toBe(actual);
  });
  it('keeps existing higher power entitlements', () => {
    const actual = buildPowerAnalysisEntitlements('premium');
    expect(applyWechatFreePowerEntitlements(actual, true)).toEqual(actual);
  });
  it('overlays 1GB in validation without writing permanent storage expansion', async () => {
    mocks.free = true;
    mocks.updates.length = 0;
    expect(await checkStorageAvailable('u', 100 * 1024 * 1024)).toEqual({ success: true });
    expect(mocks.updates).toEqual([]);
    expect((await checkStorageAvailable('u', 800 * 1024 * 1024)).success).toBe(false);
    mocks.free = false;
    expect((await checkStorageAvailable('u', 100 * 1024 * 1024)).success).toBe(false);
  });
});
