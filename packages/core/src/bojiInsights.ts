/**
 * 薄肌检测器的「排名 / 最像谁 / PK」：网页、小程序和 API 共用的类型与纯函数。
 * 只处理分数，不涉及照片。
 */

import { bojiReportSex, type BojiMetricKey, type BojiReport, type BojiSex } from './bojiDetector';
import { matchBojiFemaleLookalike, matchBojiLookalike, type BojiLookalikeMatch } from './bojiLookalikes';

// ---------------------------------------------------------------------------
// 分数快照：一次检测里可用于排名、匹配和 PK 的数值
// ---------------------------------------------------------------------------

/** waist_hip 只有女性档有 */
export type BojiMetricScores = Record<Exclude<BojiMetricKey, 'waist_hip'>, number | null> & { waist_hip?: number | null };

export interface BojiScoreSnapshot {
  sex: BojiSex;
  total: number | null;
  scores: BojiMetricScores;
  shoulderWaistRatio: number | null;
  upperArmRatio: number | null;
  absPackCount: number | null;
  absDefinition: number | null;
  silhouetteIou: number | null;
  /** 女性档 */
  waistHipRatio: number | null;
  absLineIndex: number | null;
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
  const sex = bojiReportSex(report);
  const scores: BojiMetricScores = {
    abs: score('abs'),
    v_taper: score('v_taper'),
    arms: score('arms'),
    symmetry: score('symmetry'),
  };
  if (sex === 'female') scores.waist_hip = score('waist_hip');
  return {
    sex,
    total: round1(finite(report?.total?.score)),
    scores,
    shoulderWaistRatio: value('v_taper', 'ratio'),
    upperArmRatio: value('arms', 'upper_ratio'),
    absPackCount: value('abs', 'pack_count'),
    absDefinition: value('abs', 'definition_index'),
    silhouetteIou: value('symmetry', 'silhouette_iou'),
    waistHipRatio: sex === 'female' ? value('waist_hip', 'ratio') : null,
    absLineIndex: sex === 'female' ? value('abs', 'line_index') : null,
  };
}

/** 至少一项单项分可用才值得记录（照片完全测不了时不入库）。 */
export function isRecordableBojiSnapshot(snapshot: BojiScoreSnapshot): boolean {
  return Object.values(snapshot.scores).some((v) => v !== null && v !== undefined);
}

/** 匹配人物用的原始测量（不是单项分）：男性看腹肌块、肩腰比、上臂；女性看马甲线、腰臀比、肩腰比。 */
export interface BojiLookalikeInput {
  absDefinition?: number | null;
  shoulderWaistRatio?: number | null;
  upperArmRatio?: number | null;
  absLineIndex?: number | null;
  waistHipRatio?: number | null;
}

export function lookalikeForMeasures(sex: BojiSex, m: BojiLookalikeInput): BojiLookalikeMatch | null {
  if (sex === 'female') {
    return matchBojiFemaleLookalike({
      absLineIndex: m.absLineIndex,
      waistHipRatio: m.waistHipRatio,
      shoulderWaistRatio: m.shoulderWaistRatio,
    });
  }
  return matchBojiLookalike({
    absDefinition: m.absDefinition,
    shoulderWaistRatio: m.shoulderWaistRatio,
    upperArmRatio: m.upperArmRatio,
  });
}

export function lookalikeForSnapshot(snapshot: BojiScoreSnapshot): BojiLookalikeMatch | null {
  return lookalikeForMeasures(snapshot.sex, snapshot);
}

// ---------------------------------------------------------------------------
// 超越比例：只用预设分布，不用真实检测数据
// ---------------------------------------------------------------------------

/*
 * 「超越了约 X% 的人」比的是普通人，不是来测的人。主动拍照来测的大多身材好
 * （线上前 114 次男性检测均值 78.4），按真实数据拟合会让练得不错的人只「超越 50%」。
 * 所以永远按下面的预设分布算，不随检测数据变化（用户 2026-10-27 决定）。
 * 均值取普通人水平：男 78 分约超越 84%，女 67 分约超越 79%。
 */
export const BOJI_PERCENTILE_PRIOR = { mean: 62, sd: 16 };
export const BOJI_FEMALE_PERCENTILE_PRIOR = { mean: 54, sd: 16 };

export interface BojiPercentile {
  /** 超越的人数比例，1–99 的整数 */
  value: number;
  /** 一律按预设分布估算；保留字段以兼容已发出的客户端 */
  basis: 'estimate';
  sampleUsers: 0;
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

export function bojiPercentile(total: number | null, sex: BojiSex = 'male'): BojiPercentile | null {
  if (total === null || !Number.isFinite(total)) return null;
  const prior = sex === 'female' ? BOJI_FEMALE_PERCENTILE_PRIOR : BOJI_PERCENTILE_PRIOR;
  return { value: estimateBojiPercentile(total, prior), basis: 'estimate', sampleUsers: 0 };
}

// ---------------------------------------------------------------------------
// PK
// ---------------------------------------------------------------------------

/** 公开的 PK 卡片：只有昵称、头像和分数，没有照片 */
export interface BojiChallengeCard {
  id: string;
  sex: BojiSex;
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

export const BOJI_DUEL_ORDER: BojiMetricKey[] = ['abs', 'waist_hip', 'v_taper', 'arms', 'symmetry'];

/** 女性档不看手臂：手臂分不进 PK */
const FEMALE_SKIPPED: BojiMetricKey[] = ['arms'];

function outcomeOf(mine: number, theirs: number): BojiDuelOutcome {
  const a = Math.round(mine);
  const b = Math.round(theirs);
  return a === b ? 'tie' : a > b ? 'win' : 'lose';
}

type DuelSide = { total: number | null; scores: BojiMetricScores; sex?: BojiSex };

function duelScore(side: DuelSide, key: BojiMetricKey): number | null {
  if (side.sex === 'female' && FEMALE_SKIPPED.includes(key)) return null;
  const v = side.scores[key as keyof BojiMetricScores];
  return typeof v === 'number' ? v : null;
}

function inDuel(key: BojiMetricKey, mine: DuelSide, theirs: DuelSide): boolean {
  const female = mine.sex === 'female' || theirs.sex === 'female';
  if (key === 'waist_hip') return female;
  if (key === 'arms') return mine.sex !== 'female' || theirs.sex !== 'female';
  return true;
}

/** 男女对战时各按自己的标准打分，只比双方都有的项（另一方没有的项显示「不计」）。 */
export function compareBojiScores(mine: DuelSide, theirs: DuelSide): BojiDuel {
  const lines: BojiDuelLine[] = BOJI_DUEL_ORDER.filter((key) => inDuel(key, mine, theirs)).map((key) => {
    const a = duelScore(mine, key);
    const b = duelScore(theirs, key);
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
  /** 一男一女：各按自己的标准打分 */
  mixedSex?: boolean;
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
  waist_hip: '腰臀比',
};

const FEMALE_DUEL_LABELS: Partial<Record<BojiMetricKey, string>> = { abs: '马甲线', v_taper: '肩腰比' };

/** 按看的人的性别显示项目名 */
export function bojiDuelMetricLabel(key: BojiMetricKey, sex: BojiSex): string {
  return (sex === 'female' ? FEMALE_DUEL_LABELS[key] : undefined) ?? BOJI_DUEL_METRIC_LABELS[key];
}

export const BOJI_DUEL_MIXED_TIP = '男生和女生各按自己的标准打分，只比双方都能测的项，图个乐。';

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
