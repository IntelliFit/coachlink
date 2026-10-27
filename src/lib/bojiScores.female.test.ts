import { describe, expect, it, vi } from 'vitest';
import type { BojiAnalysisDto, BojiMetric } from '@coachlink/core/src/bojiDetector';
import { buildBojiInsights, getBojiChallengeView, supabaseBojiScoreStore, type BojiScoreStore, type NewBojiScore, type StoredBojiScore } from './bojiScores';

vi.mock('@/lib/supabaseClient', () => ({ serviceRoleSupabase: {} }));

const INVITE = '11111111-1111-4111-8111-111111111111';

function metric(key: BojiMetric['key'], score: number | null, values: Record<string, number> = {}): BojiMetric {
  return { key, status: score === null ? 'unavailable' : 'ok', score, values, reasons: [], geometry: {} };
}

function femaleAnalysis(): BojiAnalysisDto {
  return {
    report: {
      version: '0.2.0',
      image_size: [800, 1000],
      deskew_deg: 0,
      quality: [],
      profile: 'female',
      metrics: {
        abs: metric('abs', 80, { line_index: 0.02 }),
        v_taper: metric('v_taper', 70, { ratio: 1.6 }),
        arms: metric('arms', 99),
        symmetry: metric('symmetry', 60),
        waist_hip: metric('waist_hip', 90, { ratio: 0.68 }),
      },
      total: { score: 78, weights_used: {}, missing: [], calibration: 'uncalibrated-v0' },
      to_original: [[1, 0, 0], [0, 1, 0]],
      original_size: null,
    },
    messages: {},
  };
}

function row(id: string, userId: string, patch: Partial<StoredBojiScore> = {}): StoredBojiScore {
  return {
    id,
    user_id: userId,
    total_score: 70,
    abs_score: 75,
    v_taper_score: 80,
    arms_score: 60,
    symmetry_score: 60,
    shoulder_waist_ratio: 1.8,
    upper_arm_ratio: 0.4,
    abs_definition: 0.7,
    created_at: '2026-10-26T00:00:00Z',
    ...patch,
  };
}

function store(rows: StoredBojiScore[] = []) {
  const inserted: NewBojiScore[] = [];
  const s: BojiScoreStore = {
    insert: vi.fn(async (score: NewBojiScore) => {
      inserted.push(score);
      return 'new-1';
    }),
    find: vi.fn(async (id: string) => rows.find((r) => r.id === id) ?? null),
    rankTotal: vi.fn(async () => ({ sampleUsers: 5, belowUsers: 2 })),
    listResponses: vi.fn(async () => rows.filter((r) => r.id !== INVITE)),
    profiles: vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, { nickname: id, avatarUrl: '' }]))),
  };
  return { s, inserted };
}

describe('female insights on the server', () => {
  it('uses the female prior and matches the female list', async () => {
    const { s, inserted } = store();
    const insights = await buildBojiInsights({ analysis: femaleAnalysis(), userId: 'me', store: s });
    expect(s.rankTotal).not.toHaveBeenCalled();
    expect(insights.percentile).toEqual({ value: 93, basis: 'estimate', sampleUsers: 0 });
    expect(inserted[0].snapshot).toMatchObject({ sex: 'female', waistHipRatio: 0.68, absLineIndex: 0.02 });
    expect(insights.lookalike?.groupLabel).toBeTruthy();
    expect(insights.scoreId).toBe('new-1');
  });

  it('flags a PK between a woman and a man and skips arms for her', async () => {
    const { s } = store([row(INVITE, 'him')]);
    const insights = await buildBojiInsights({ analysis: femaleAnalysis(), userId: 'me', challengeId: INVITE, store: s });
    expect(insights.challenge?.mixedSex).toBe(true);
    expect(insights.challenge?.opponent.sex).toBe('male');
    const arms = insights.challenge?.duel.lines.find((l) => l.key === 'arms');
    expect(arms).toMatchObject({ mine: null, outcome: null });
  });

  it('reads women rows back with their waist/hip score', async () => {
    const { s } = store([row(INVITE, 'her', { sex: 'female', waist_hip_score: 88 })]);
    const view = await getBojiChallengeView({ id: INVITE, viewerId: null, store: s });
    expect(view?.card).toMatchObject({ sex: 'female', scores: { waist_hip: 88 } });
  });
});

describe('supabase store', () => {
  function fakeDb() {
    const calls: { table?: string; insert?: Record<string, unknown>; rpc?: [string, Record<string, unknown>] }[] = [];
    const db = {
      from(table: string) {
        return {
          insert(values: Record<string, unknown>) {
            calls.push({ table, insert: values });
            return { select: () => ({ single: async () => ({ data: { id: 'x' }, error: null }) }) };
          },
        };
      },
      async rpc(name: string, args: Record<string, unknown>) {
        calls.push({ rpc: [name, args] });
        return { data: [{ sample_users: 3, below_users: 1 }], error: null };
      },
    };
    return { db, calls };
  }

  it('writes the female columns only for women', async () => {
    const { db, calls } = fakeDb();
    const st = supabaseBojiScoreStore(db);
    const base = { total: 70, scores: { abs: 1, v_taper: 2, arms: 3, symmetry: 4 }, shoulderWaistRatio: null, upperArmRatio: null,
      absPackCount: null, absDefinition: null, silhouetteIou: null, waistHipRatio: null, absLineIndex: null };
    await st.insert({ userId: 'u', snapshot: { ...base, sex: 'male' }, lookalikeKey: null, challengeScoreId: null, engineVersion: null });
    await st.insert({
      userId: 'u',
      snapshot: { ...base, sex: 'female', scores: { ...base.scores, waist_hip: 5 }, waistHipRatio: 0.7, absLineIndex: 0.01 },
      lookalikeKey: null,
      challengeScoreId: null,
      engineVersion: null,
    });
    expect(calls[0].insert).not.toHaveProperty('sex');
    expect(calls[0].insert).not.toHaveProperty('waist_hip_score');
    expect(calls[1].insert).toMatchObject({ sex: 'female', waist_hip_score: 5, waist_hip_ratio: 0.7, abs_line_index: 0.01 });
  });

  it('uses the by-sex rank function for women and the original one otherwise', async () => {
    const { db, calls } = fakeDb();
    const st = supabaseBojiScoreStore(db);
    await st.rankTotal(60, 'u');
    await st.rankTotal(60, 'u', 'female');
    expect(calls[0].rpc?.[0]).toBe('boji_total_score_rank');
    expect(calls[1].rpc).toEqual(['boji_total_score_rank_by_sex', { p_score: 60, p_exclude_user: 'u', p_sex: 'female' }]);
  });
});
