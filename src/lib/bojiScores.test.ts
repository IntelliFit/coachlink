import { describe, expect, it, vi } from 'vitest';
import type { BojiAnalysisDto, BojiMetric } from '@coachlink/core/src/bojiDetector';
import { buildBojiInsights, getBojiChallengeView, type BojiScoreStore, type NewBojiScore, type StoredBojiScore } from './bojiScores';

vi.mock('@/lib/supabaseClient', () => ({ serviceRoleSupabase: {} }));

const OWNER_SCORE = '11111111-1111-4111-8111-111111111111';

function metric(key: BojiMetric['key'], score: number | null): BojiMetric {
  return { key, status: score === null ? 'unavailable' : 'ok', score, values: {}, reasons: [], geometry: {} };
}

function analysis(scores: { abs: number | null; v: number | null; arms: number | null; sym: number | null }, total: number | null): BojiAnalysisDto {
  return {
    report: {
      version: '0.1.1',
      image_size: [800, 1000],
      deskew_deg: 0,
      quality: [],
      metrics: {
        abs: metric('abs', scores.abs),
        v_taper: metric('v_taper', scores.v),
        arms: metric('arms', scores.arms),
        symmetry: metric('symmetry', scores.sym),
      },
      total: { score: total, weights_used: {}, missing: [], calibration: 'uncalibrated-v0' },
      to_original: [[1, 0, 0], [0, 1, 0]],
      original_size: null,
    },
    messages: {},
  };
}

function stored(id: string, userId: string, patch: Partial<StoredBojiScore> = {}): StoredBojiScore {
  return {
    id,
    user_id: userId,
    total_score: 70,
    abs_score: 80,
    v_taper_score: 70,
    arms_score: 60,
    symmetry_score: 50,
    created_at: '2026-10-25T00:00:00Z',
    ...patch,
  };
}

function memoryStore(rows: StoredBojiScore[] = [], sample = { sampleUsers: 3, belowUsers: 2 }) {
  const inserted: NewBojiScore[] = [];
  const store: BojiScoreStore = {
    insert: vi.fn(async (score: NewBojiScore) => {
      inserted.push(score);
      return `new-${inserted.length}`;
    }),
    find: vi.fn(async (id: string) => rows.find((r) => r.id === id) ?? null),
    rankTotal: vi.fn(async () => sample),
    listResponses: vi.fn(async () => rows.filter((r) => r.id !== OWNER_SCORE)),
    profiles: vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, { nickname: `昵称-${id}`, avatarUrl: '' }]))),
  };
  return { store, inserted };
}

describe('buildBojiInsights', () => {
  it('records the scores, estimates the percentile and matches a lookalike', async () => {
    const { store, inserted } = memoryStore();
    const insights = await buildBojiInsights({ analysis: analysis({ abs: 90, v: 85, arms: 70, sym: 80 }, 82), userId: 'me', store });
    expect(insights.scoreId).toBe('new-1');
    expect(insights.percentile).toMatchObject({ basis: 'estimate', sampleUsers: 3 });
    expect(insights.lookalike?.name).toBeTruthy();
    expect(insights.challenge).toBeNull();
    expect(inserted[0]).toMatchObject({ userId: 'me', challengeScoreId: null, engineVersion: '0.1.1' });
    expect(inserted[0].snapshot.total).toBe(82);
    expect(store.rankTotal).toHaveBeenCalledWith(82, 'me');
  });

  it('does not record a photo where no metric could be measured', async () => {
    const { store } = memoryStore();
    const insights = await buildBojiInsights({ analysis: analysis({ abs: null, v: null, arms: null, sym: null }, null), userId: 'me', store });
    expect(insights).toEqual({ scoreId: null, percentile: null, lookalike: null, challenge: null });
    expect(store.insert).not.toHaveBeenCalled();
  });

  it('compares with the inviter and links the answer to their score', async () => {
    const { store, inserted } = memoryStore([stored(OWNER_SCORE, 'friend')]);
    const insights = await buildBojiInsights({
      analysis: analysis({ abs: 90, v: 60, arms: 70, sym: null }, 75),
      userId: 'me',
      challengeId: OWNER_SCORE,
      store,
    });
    expect(inserted[0].challengeScoreId).toBe(OWNER_SCORE);
    expect(insights.challenge?.opponent).toMatchObject({ id: OWNER_SCORE, nickname: '昵称-friend', total: 70 });
    expect(insights.challenge?.duel).toMatchObject({ wins: 2, losses: 1, ties: 0, overall: 'win' });
  });

  it('ignores a PK against yourself and malformed ids', async () => {
    const { store, inserted } = memoryStore([stored(OWNER_SCORE, 'me')]);
    const own = await buildBojiInsights({ analysis: analysis({ abs: 90, v: 60, arms: 70, sym: 60 }, 75), userId: 'me', challengeId: OWNER_SCORE, store });
    expect(own.challenge).toBeNull();
    expect(inserted[0].challengeScoreId).toBeNull();
    await buildBojiInsights({ analysis: analysis({ abs: 90, v: 60, arms: 70, sym: 60 }, 75), userId: 'me', challengeId: "x' or 1=1", store });
    expect(store.find).toHaveBeenCalledTimes(1);
  });

  it('still answers when the database fails', async () => {
    const { store } = memoryStore();
    store.insert = vi.fn(async () => { throw new Error('db down'); });
    store.rankTotal = vi.fn(async () => { throw new Error('db down'); });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const insights = await buildBojiInsights({ analysis: analysis({ abs: 90, v: 85, arms: 70, sym: 80 }, 55), userId: 'me', store });
      expect(insights.scoreId).toBeNull();
      expect(insights.percentile).toEqual({ value: 50, basis: 'estimate', sampleUsers: 0 });
    } finally {
      spy.mockRestore();
    }
  });

  it('switches to the measured percentile once 100 people have results', async () => {
    const { store } = memoryStore([], { sampleUsers: 200, belowUsers: 50 });
    const insights = await buildBojiInsights({ analysis: analysis({ abs: 90, v: 85, arms: 70, sym: 80 }, 82), userId: 'me', store });
    expect(insights.percentile).toEqual({ value: 25, basis: 'measured', sampleUsers: 200 });
  });
});

describe('getBojiChallengeView', () => {
  const rows = [
    stored(OWNER_SCORE, 'owner'),
    stored('22222222-2222-4222-8222-222222222222', 'friend-a', { abs_score: 90, v_taper_score: 80, arms_score: 70, symmetry_score: 60, total_score: 80 }),
  ];

  it('shows the inviter card to anyone without the responses', async () => {
    const { store } = memoryStore(rows);
    const view = await getBojiChallengeView({ id: OWNER_SCORE, viewerId: null, store });
    expect(view).toMatchObject({ isOwner: false, responses: [], card: { id: OWNER_SCORE, nickname: '昵称-owner', total: 70 } });
    expect(store.listResponses).not.toHaveBeenCalled();
  });

  it('lists who answered, from the inviter side, to the inviter only', async () => {
    const { store } = memoryStore(rows);
    const view = await getBojiChallengeView({ id: OWNER_SCORE, viewerId: 'owner', store });
    expect(view?.isOwner).toBe(true);
    expect(view?.responses).toEqual([
      { nickname: '昵称-friend-a', avatarUrl: '', total: 80, overall: 'lose', createdAt: '2026-10-25T00:00:00Z' },
    ]);
  });

  it('returns null for unknown or malformed ids', async () => {
    const { store } = memoryStore(rows);
    expect(await getBojiChallengeView({ id: '33333333-3333-4333-8333-333333333333', viewerId: null, store })).toBeNull();
    expect(await getBojiChallengeView({ id: 'nope', viewerId: null, store })).toBeNull();
  });
});
