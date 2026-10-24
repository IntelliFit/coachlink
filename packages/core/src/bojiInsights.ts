/**
 * 薄肌检测器的「排名 / 最像谁 / PK」：网页、小程序和 API 共用的类型与纯函数。
 * 只处理分数，不涉及照片。
 */

import type { BojiMetricKey, BojiReport } from './bojiDetector';
import { matchBojiLookalike, type BojiLookalikeMatch } from './bojiLookalikes';

// ---------------------------------------------------------------------------
// 分数快照：一次检测里可用于排名、匹配和 PK 的数值
// ---------------------------------------------------------------------------

export type BojiMetricScores = Record<BojiMetricKey, number | null>;

export interface BojiScoreSnapshot {
  total: number | null;
  scores: BojiMetricScores;
  shoulderWaistRatio: number | null;
  upperArmRatio: number | null;
  absPackCount: number | null;
  absDefinition: number | null;
  silhouetteIou: number | null;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function round1(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

export function bojiScoreSnapshot(report: BojiReport | null | undefined): BojiScoreSnapshot {
  const metrics = (report?.metrics ?? {}) as Partial<BojiReport['metrics']>;
  const score = (key: BojiMetricKey): number | null => {
    const metric = metrics[key];
    if (!metric || metric.status === 'unavailable') return null;
    return round1(finite(metric.score));
  };
  const value = (key: BojiMetricKey, field: string): number | null => {
    const metric = metrics[key];
    if (!metric || metric.status === 'unavailable') return null;
    return finite(metric.values?.[field]);
  };
  return {
    total: round1(finite(report?.total?.score)),
    scores: { abs: score('abs'), v_taper: score('v_taper'), arms: score('arms'), symmetry: score('symmetry') },
    shoulderWaistRatio: value('v_taper', 'ratio'),
    upperArmRatio: value('arms', 'upper_ratio'),
    absPackCount: value('abs', 'pack_count'),
    absDefinition: value('abs', 'definition_index'),
    silhouetteIou: value('symmetry', 'silhouette_iou'),
  };
}

/** 至少一项单项分可用才值得记录（照片完全测不了时不入库）。 */
export function isRecordableBojiSnapshot(snapshot: BojiScoreSnapshot): boolean {
  return Object.values(snapshot.scores).some((v) => v !== null);
}

export function lookalikeForSnapshot(snapshot: BojiScoreSnapshot): BojiLookalikeMatch | null {
  return matchBojiLookalike({
    abs: snapshot.scores.abs,
    vTaper: snapshot.scores.v_taper,
    arms: snapshot.scores.arms,
  });
}

// ---------------------------------------------------------------------------
// 超越比例：真实检测人数不足时用预设分布估算，够了以后换真实分布
// ---------------------------------------------------------------------------

/** 预设的综合分分布（正态）。用测试照片的分数大致定的：普通人偏低，练过的人 60–90。 */
export const BOJI_PERCENTILE_PRIOR = { mean: 55, sd: 16 };
/** 真实检测人数（按人去重）达到这个数后改用真实分布 */
export const BOJI_PERCENTILE_MIN_REAL_USERS = 100;

export interface BojiPercentile {
  /** 超越的人数比例，1–99 的整数 */
  value: number;
  basis: 'estimate' | 'measured';
  sampleUsers: number;
}

// Abramowitz–Stegun 7.1.26，误差 < 1.5e-7
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
}

function clampPercent(fraction: number): number {
  return Math.min(99, Math.max(1, Math.round(fraction * 100)));
}

export function estimateBojiPercentile(total: number, prior = BOJI_PERCENTILE_PRIOR): number {
  const z = (total - prior.mean) / (prior.sd * Math.SQRT2);
  return clampPercent(0.5 * (1 + erf(z)));
}

/**
 * sampleUsers / belowUsers：除本人以外、按人取最好成绩后的总人数和低于本次分数的人数。
 */
export function bojiPercentile(
  total: number | null,
  sample: { sampleUsers: number; belowUsers: number } | null,
  minRealUsers = BOJI_PERCENTILE_MIN_REAL_USERS,
): BojiPercentile | null {
  if (total === null || !Number.isFinite(total)) return null;
  const sampleUsers = Math.max(0, Math.floor(sample?.sampleUsers ?? 0));
  if (sample && sampleUsers >= minRealUsers) {
    const below = Math.min(sampleUsers, Math.max(0, Math.floor(sample.belowUsers)));
    return { value: clampPercent(below / sampleUsers), basis: 'measured', sampleUsers };
  }
  return { value: estimateBojiPercentile(total), basis: 'estimate', sampleUsers };
}

// ---------------------------------------------------------------------------
// PK
// ---------------------------------------------------------------------------

/** 公开的 PK 卡片：只有昵称、头像和分数，没有照片 */
export interface BojiChallengeCard {
  id: string;
  nickname: string;
  avatarUrl: string;
  total: number | null;
  scores: BojiMetricScores;
  lookalike: BojiLookalikeMatch | null;
  createdAt: string;
}

export type BojiDuelOutcome = 'win' | 'lose' | 'tie';

export interface BojiDuelLine {
  key: BojiMetricKey;
  mine: number | null;
  theirs: number | null;
  /** 任一方这项测不了时为 null，不计胜负 */
  outcome: BojiDuelOutcome | null;
}

export interface BojiDuel {
  lines: BojiDuelLine[];
  wins: number;
  losses: number;
  ties: number;
  /** 先比赢的项数，相同再比综合分 */
  overall: BojiDuelOutcome;
}

export const BOJI_DUEL_ORDER: BojiMetricKey[] = ['abs', 'v_taper', 'arms', 'symmetry'];

function outcomeOf(mine: number, theirs: number): BojiDuelOutcome {
  const a = Math.round(mine);
  const b = Math.round(theirs);
  return a === b ? 'tie' : a > b ? 'win' : 'lose';
}

export function compareBojiScores(
  mine: { total: number | null; scores: BojiMetricScores },
  theirs: { total: number | null; scores: BojiMetricScores },
): BojiDuel {
  const lines: BojiDuelLine[] = BOJI_DUEL_ORDER.map((key) => {
    const a = mine.scores[key];
    const b = theirs.scores[key];
    return { key, mine: a, theirs: b, outcome: a === null || b === null ? null : outcomeOf(a, b) };
  });
  const count = (o: BojiDuelOutcome) => lines.filter((l) => l.outcome === o).length;
  const wins = count('win');
  const losses = count('lose');
  let overall: BojiDuelOutcome = wins > losses ? 'win' : wins < losses ? 'lose' : 'tie';
  if (overall === 'tie' && mine.total !== null && theirs.total !== null) {
    overall = outcomeOf(mine.total, theirs.total);
  }
  return { lines, wins, losses, ties: count('tie'), overall };
}

// ---------------------------------------------------------------------------
// API 附加在检测结果上的字段
// ---------------------------------------------------------------------------

export interface BojiChallengeOutcome {
  opponent: BojiChallengeCard;
  duel: BojiDuel;
}

export interface BojiInsights {
  /** 本次成绩的 id，用来发起 PK；没入库时为 null */
  scoreId: string | null;
  percentile: BojiPercentile | null;
  lookalike: BojiLookalikeMatch | null;
  challenge: BojiChallengeOutcome | null;
}

/** 好友应战记录：发起人查看自己的 PK 卡时才返回 */
export interface BojiChallengeResponse {
  nickname: string;
  avatarUrl: string;
  total: number | null;
  /** 站在发起人一方的结果 */
  overall: BojiDuelOutcome;
  createdAt: string;
}

export interface BojiChallengeView {
  card: BojiChallengeCard;
  isOwner: boolean;
  responses: BojiChallengeResponse[];
}

export const BOJI_DUEL_LABELS: Record<BojiDuelOutcome, string> = { win: '赢', lose: '输', tie: '平' };

export const BOJI_DUEL_METRIC_LABELS: Record<BojiMetricKey, string> = {
  abs: '腹肌',
  v_taper: '倒三角',
  arms: '手臂围度',
  symmetry: '左右对称',
};

/** PK 时腹肌受光线影响最大，提示双方 */
export const BOJI_DUEL_LIGHTING_TIP = '腹肌分数受光线影响大，同样的地点和光线比才公平。';

export function bojiPercentileText(percentile: BojiPercentile | null): string {
  return percentile ? `超越了约 ${percentile.value}% 的人` : '';
}

export function bojiLookalikeText(match: BojiLookalikeMatch | null): string {
  if (!match) return '';
  return match.closeness === 'close' ? `你的身材最接近：${match.name}` : `照这个方向练，最可能成为：${match.name}`;
}

export function bojiDuelHeadline(duel: BojiDuel): string {
  const score = `${duel.wins} 胜 ${duel.losses} 负${duel.ties ? ` ${duel.ties} 平` : ''}`;
  if (duel.overall === 'win') return `你赢了！${score}`;
  if (duel.overall === 'lose') return `惜败，${score}`;
  return `打平了，${score}`;
}

export function bojiShareTitle(total: number | null, percentile: BojiPercentile | null): string {
  if (total === null) return '薄肌检测器：来和我 PK 身材';
  const beat = percentile ? `，超越了约 ${percentile.value}% 的人` : '';
  return `我的薄肌综合 ${Math.round(total)} 分${beat}，敢来 PK 吗？`;
}

/** 校验 PK id（uuid），挡掉拼接进查询前的脏输入 */
export function isBojiScoreId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
