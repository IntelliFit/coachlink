/**
 * 薄肌检测器结果页的展示计算（2026-10-26 改版）：长板/短板、训练建议、
 * 雷达图和环形分的几何，以及 PK 小程序码的 scene 编解码。网页和小程序共用。
 */

import { bojiMetricOrder, type BojiMetricKey, type BojiSex } from './bojiDetector';
import { bojiDuelMetricLabel, type BojiMetricScores } from './bojiInsights';

/** 男女各看四项：男生腹肌、倒三角、手臂、对称；女生马甲线、腰臀比、肩腰比、对称 */
export function bojiDisplayKeys(sex: BojiSex): BojiMetricKey[] {
  return bojiMetricOrder(sex);
}

function scoreOf(scores: BojiMetricScores, key: BojiMetricKey): number | null {
  const v = scores[key as keyof BojiMetricScores];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** 图上用的短名：手臂围度 → 手臂，左右对称 → 对称 */
export function bojiShortMetricLabel(key: BojiMetricKey, sex: BojiSex): string {
  const label = bojiDuelMetricLabel(key, sex);
  return label === '手臂围度' ? '手臂' : label === '左右对称' ? '对称' : label;
}

export interface BojiMetricHighlight {
  key: BojiMetricKey;
  label: string;
  score: number;
}

export interface BojiStrengths {
  best: BojiMetricHighlight;
  weakest: BojiMetricHighlight;
}

/** 至少两项能测才谈长板短板；分数相同按固定顺序取第一个 */
export function bojiStrengths(scores: BojiMetricScores, sex: BojiSex = 'male'): BojiStrengths | null {
  const items: BojiMetricHighlight[] = [];
  for (const key of bojiDisplayKeys(sex)) {
    const score = scoreOf(scores, key);
    if (score !== null) items.push({ key, label: bojiShortMetricLabel(key, sex), score: Math.round(score) });
  }
  if (items.length < 2) return null;
  let best = items[0];
  let weakest = items[0];
  for (const item of items) {
    if (item.score > best.score) best = item;
    if (item.score < weakest.score) weakest = item;
  }
  return best.key === weakest.key ? null : { best, weakest };
}

const TRAINING_TIPS: Record<BojiMetricKey, string> = {
  abs: '腹肌是最快能提分的地方：控制体脂，加上卷腹、悬垂举腿，线条会更清楚。',
  v_taper: '倒三角是最快能提分的地方：多练引体、划船和侧平举，把肩背练宽。',
  arms: '手臂围度是最快能提分的地方：多练二头、三头和肩前束。',
  symmetry: '左右对称是最快能提分的地方：多做单侧动作，先练弱的一侧，拍照时站正。',
  waist_hip: '腰臀比是最快能提分的地方：多练臀桥、硬拉和保加利亚分腿蹲，把臀部练起来。',
};

const FEMALE_TRAINING_TIPS: Partial<Record<BojiMetricKey, string>> = {
  abs: '马甲线是最快能提分的地方：在健康体脂范围内，多做死虫、平板支撑和悬垂举腿。',
  v_taper: '肩腰比是最快能提分的地方：多练侧平举、推肩和高位下拉，肩线会更挺。',
};

/** 针对短板的一句训练建议 */
export function bojiTrainingTip(strengths: BojiStrengths | null, sex: BojiSex = 'male'): string {
  if (!strengths) return '';
  const key = strengths.weakest.key;
  return (sex === 'female' ? FEMALE_TRAINING_TIPS[key] : undefined) ?? TRAINING_TIPS[key];
}

// ---------------------------------------------------------------------------
// 图形几何
// ---------------------------------------------------------------------------

export interface BojiRadarAxis {
  key: BojiMetricKey;
  label: string;
  score: number | null;
  /** 轴端点（100 分处） */
  end: [number, number];
  /** 本人分数所在点；测不了时落在圆心 */
  point: [number, number];
}

/** 四个轴依次朝上、右、下、左，顺序同 bojiDisplayKeys(sex) */
export function bojiRadarAxes(
  scores: BojiMetricScores,
  cx: number,
  cy: number,
  radius: number,
  sex: BojiSex = 'male',
): BojiRadarAxis[] {
  return bojiDisplayKeys(sex).map((key, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const raw = scoreOf(scores, key);
    const score = raw === null ? null : Math.min(100, Math.max(0, raw));
    const r = ((score ?? 0) / 100) * radius;
    const round = (v: number) => Math.round(v * 100) / 100;
    return {
      key,
      label: bojiShortMetricLabel(key, sex),
      score: score === null ? null : Math.round(score),
      end: [round(cx + dx * radius), round(cy + dy * radius)],
      point: [round(cx + dx * r), round(cy + dy * r)],
    };
  });
}

/** 环形进度：返回已填充弧长和整圈周长，供 SVG stroke-dasharray 或 Canvas arc 用 */
export function bojiRingArc(total: number | null, radius: number): { filled: number; circumference: number; fraction: number } {
  const circumference = 2 * Math.PI * radius;
  const fraction = typeof total === 'number' && Number.isFinite(total) ? Math.min(1, Math.max(0, total / 100)) : 0;
  return { filled: circumference * fraction, circumference, fraction };
}

// ---------------------------------------------------------------------------
// PK 小程序码：scene 最长 32 个字符，成绩 id（uuid）去掉连字符正好 32 位
// ---------------------------------------------------------------------------

export function bojiChallengeScene(scoreId: string): string {
  return scoreId.replace(/-/g, '').toLowerCase();
}

/** 扫码进入时把 scene 还原成成绩 id；不是 32 位十六进制时返回 null */
export function bojiScoreIdFromScene(scene: unknown): string | null {
  const value = typeof scene === 'string' ? decodeURIComponent(scene).trim().toLowerCase() : '';
  if (!/^[0-9a-f]{32}$/.test(value)) return null;
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
