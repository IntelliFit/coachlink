import { serviceRoleSupabase } from '@/lib/supabaseClient';
import type { BojiAnalysisDto } from '@coachlink/core/src/bojiDetector';
import {
  bojiPercentile,
  bojiScoreSnapshot,
  compareBojiScores,
  isBojiScoreId,
  isRecordableBojiSnapshot,
  lookalikeForSnapshot,
  type BojiChallengeCard,
  type BojiChallengeView,
  type BojiInsights,
  type BojiMetricScores,
  type BojiScoreSnapshot,
} from '@coachlink/core/src/bojiInsights';
import { matchBojiLookalike } from '@coachlink/core/src/bojiLookalikes';

/**
 * 薄肌检测成绩（tool_boji_scores）：只存分数，不存照片。
 * 排名、最像谁和 PK 都从这里来；任何一步失败都不影响检测结果本身。
 */

export interface StoredBojiScore {
  id: string;
  user_id: string;
  total_score: number | null;
  abs_score: number | null;
  v_taper_score: number | null;
  arms_score: number | null;
  symmetry_score: number | null;
  shoulder_waist_ratio: number | null;
  upper_arm_ratio: number | null;
  abs_definition: number | null;
  created_at: string;
}

export interface NewBojiScore {
  userId: string;
  snapshot: BojiScoreSnapshot;
  lookalikeKey: string | null;
  challengeScoreId: string | null;
  engineVersion: string | null;
}

export interface BojiProfile {
  nickname: string;
  avatarUrl: string;
}

export interface BojiScoreStore {
  insert(score: NewBojiScore): Promise<string>;
  find(id: string): Promise<StoredBojiScore | null>;
  rankTotal(total: number, excludeUserId: string): Promise<{ sampleUsers: number; belowUsers: number }>;
  listResponses(challengeScoreId: string, limit: number): Promise<StoredBojiScore[]>;
  profiles(userIds: string[]): Promise<Map<string, BojiProfile>>;
}

const SCORE_COLUMNS =
  'id, user_id, total_score, abs_score, v_taper_score, arms_score, symmetry_score, shoulder_waist_ratio, upper_arm_ratio, abs_definition, created_at';
const DEFAULT_NICKNAME = '健身朋友';
const RESPONSE_LIMIT = 20;

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toStored(row: Record<string, unknown>): StoredBojiScore {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    total_score: num(row.total_score),
    abs_score: num(row.abs_score),
    v_taper_score: num(row.v_taper_score),
    arms_score: num(row.arms_score),
    symmetry_score: num(row.symmetry_score),
    shoulder_waist_ratio: num(row.shoulder_waist_ratio),
    upper_arm_ratio: num(row.upper_arm_ratio),
    abs_definition: num(row.abs_definition),
    created_at: String(row.created_at ?? ''),
  };
}

/** 新表还不在生成的数据库类型里，这里集中做一次类型收口。 */
export function supabaseBojiScoreStore(db: unknown = serviceRoleSupabase): BojiScoreStore {
  const client = db as any;
  return {
    async insert({ userId, snapshot, lookalikeKey, challengeScoreId, engineVersion }) {
      const { data, error } = await client
        .from('tool_boji_scores')
        .insert({
          user_id: userId,
          total_score: snapshot.total,
          abs_score: snapshot.scores.abs,
          v_taper_score: snapshot.scores.v_taper,
          arms_score: snapshot.scores.arms,
          symmetry_score: snapshot.scores.symmetry,
          shoulder_waist_ratio: snapshot.shoulderWaistRatio,
          upper_arm_ratio: snapshot.upperArmRatio,
          abs_pack_count: snapshot.absPackCount,
          abs_definition: snapshot.absDefinition,
          silhouette_iou: snapshot.silhouetteIou,
          lookalike_key: lookalikeKey,
          challenge_score_id: challengeScoreId,
          engine_version: engineVersion,
        })
        .select('id')
        .single();
      if (error || !data?.id) throw new Error(`insert boji score failed: ${error?.message ?? 'no id'}`);
      return String(data.id);
    },
    async find(id) {
      const { data, error } = await client.from('tool_boji_scores').select(SCORE_COLUMNS).eq('id', id).maybeSingle();
      if (error) throw new Error(`load boji score failed: ${error.message}`);
      return data ? toStored(data) : null;
    },
    async rankTotal(total, excludeUserId) {
      const { data, error } = await client.rpc('boji_total_score_rank', { p_score: total, p_exclude_user: excludeUserId });
      if (error) throw new Error(`rank boji score failed: ${error.message}`);
      const row = Array.isArray(data) ? data[0] : data;
      return { sampleUsers: num(row?.sample_users) ?? 0, belowUsers: num(row?.below_users) ?? 0 };
    },
    async listResponses(challengeScoreId, limit) {
      const { data, error } = await client
        .from('tool_boji_scores')
        .select(SCORE_COLUMNS)
        .eq('challenge_score_id', challengeScoreId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(`load boji responses failed: ${error.message}`);
      return (data ?? []).map(toStored);
    },
    async profiles(userIds) {
      const map = new Map<string, BojiProfile>();
      const ids = Array.from(new Set(userIds.filter(Boolean)));
      if (ids.length === 0) return map;
      const { data, error } = await client.from('user_profiles').select('user_id, nickname, avatar_url').in('user_id', ids);
      if (error) throw new Error(`load profiles failed: ${error.message}`);
      for (const p of data ?? []) {
        map.set(String(p.user_id), { nickname: p.nickname || DEFAULT_NICKNAME, avatarUrl: p.avatar_url || '' });
      }
      return map;
    },
  };
}

function storedScores(row: StoredBojiScore): BojiMetricScores {
  return { abs: row.abs_score, v_taper: row.v_taper_score, arms: row.arms_score, symmetry: row.symmetry_score };
}

function toCard(row: StoredBojiScore, profile: BojiProfile | undefined): BojiChallengeCard {
  const scores = storedScores(row);
  return {
    id: row.id,
    nickname: profile?.nickname ?? DEFAULT_NICKNAME,
    avatarUrl: profile?.avatarUrl ?? '',
    total: row.total_score,
    scores,
    lookalike: matchBojiLookalike({
      absDefinition: row.abs_definition,
      shoulderWaistRatio: row.shoulder_waist_ratio,
      upperArmRatio: row.upper_arm_ratio,
    }),
    createdAt: row.created_at,
  };
}

async function safeProfiles(store: BojiScoreStore, ids: string[]): Promise<Map<string, BojiProfile>> {
  try {
    return await store.profiles(ids);
  } catch (error) {
    console.error('[boji] profiles:', error instanceof Error ? error.message : error);
    return new Map();
  }
}

/** 检测完成后：入库、算超越比例、匹配人物；带 PK id 时附上对比结果。 */
export async function buildBojiInsights({
  analysis,
  userId,
  challengeId,
  store = supabaseBojiScoreStore(),
}: {
  analysis: BojiAnalysisDto;
  userId: string;
  challengeId?: string | null;
  store?: BojiScoreStore;
}): Promise<BojiInsights> {
  const snapshot = bojiScoreSnapshot(analysis.report);
  const lookalike = lookalikeForSnapshot(snapshot);
  if (!isRecordableBojiSnapshot(snapshot)) {
    return { scoreId: null, percentile: null, lookalike, challenge: null };
  }

  let opponent: StoredBojiScore | null = null;
  if (isBojiScoreId(challengeId)) {
    try {
      const row = await store.find(challengeId);
      opponent = row && row.user_id !== userId ? row : null;
    } catch (error) {
      console.error('[boji] challenge lookup:', error instanceof Error ? error.message : error);
    }
  }

  let sample: { sampleUsers: number; belowUsers: number } | null = null;
  if (snapshot.total !== null) {
    try {
      sample = await store.rankTotal(snapshot.total, userId);
    } catch (error) {
      console.error('[boji] rank:', error instanceof Error ? error.message : error);
    }
  }

  let scoreId: string | null = null;
  try {
    scoreId = await store.insert({
      userId,
      snapshot,
      lookalikeKey: lookalike?.key ?? null,
      challengeScoreId: opponent?.id ?? null,
      engineVersion: typeof analysis.report?.version === 'string' ? analysis.report.version : null,
    });
  } catch (error) {
    console.error('[boji] record:', error instanceof Error ? error.message : error);
  }

  let challenge: BojiInsights['challenge'] = null;
  if (opponent) {
    const profiles = await safeProfiles(store, [opponent.user_id]);
    const card = toCard(opponent, profiles.get(opponent.user_id));
    challenge = { opponent: card, duel: compareBojiScores(snapshot, card) };
  }

  return { scoreId, percentile: bojiPercentile(snapshot.total, sample), lookalike, challenge };
}

/** 打开 PK 链接：任何人都能看到发起人的分数卡；发起人自己还能看到应战记录。 */
export async function getBojiChallengeView({
  id,
  viewerId,
  store = supabaseBojiScoreStore(),
}: {
  id: string;
  viewerId: string | null;
  store?: BojiScoreStore;
}): Promise<BojiChallengeView | null> {
  if (!isBojiScoreId(id)) return null;
  const row = await store.find(id);
  if (!row) return null;
  const isOwner = viewerId !== null && viewerId === row.user_id;
  const responses = isOwner ? await store.listResponses(row.id, RESPONSE_LIMIT) : [];
  const profiles = await safeProfiles(store, [row.user_id, ...responses.map((r) => r.user_id)]);
  const card = toCard(row, profiles.get(row.user_id));
  return {
    card,
    isOwner,
    responses: responses.map((r) => {
      const other = toCard(r, profiles.get(r.user_id));
      return {
        nickname: other.nickname,
        avatarUrl: other.avatarUrl,
        total: other.total,
        overall: compareBojiScores(card, other).overall,
        createdAt: other.createdAt,
      };
    }),
  };
}
