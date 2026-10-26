/**
 * 薄肌检测器「身材最像谁」。
 *
 * 用三项原始测量值匹配：腹肌清晰度（definition_index）、肩腰比、上臂宽/长。
 * 每项先和真实用户的中位水平比，换算成连续档位（0 为中位，±1 约一个四分位距），
 * 再取档位最接近的人物。名单见 bojiLookalikeRoster.ts，每位人物占一个不同的档位点，
 * 所以练得好的人也会按各自特点分散到不同人物上（2026-10-26 前按单项分匹配，单项分
 * 普遍接近满分，结果三成以上都是 CBum）。
 */

import {
  BOJI_LOOKALIKE_GROUP_LABELS,
  BOJI_LOOKALIKES,
  type BojiLookalike,
  type BojiLookalikeTarget,
} from './bojiLookalikeRoster';
import { BOJI_LOOKALIKE_PHOTOS } from './bojiLookalikePhotos';

export {
  BOJI_LOOKALIKE_GROUP_LABELS,
  BOJI_LOOKALIKES,
  type BojiLookalike,
  type BojiLookalikeGroup,
  type BojiLookalikeTarget,
} from './bojiLookalikeRoster';

/**
 * 每项原始测量的中位水平和「一档」的距离：取自 2026-10-25 线上
 * 114 次检测（48 人）的中位数和四分位距（IQR / 1.35）。
 */
export const BOJI_LOOKALIKE_REFERENCE = {
  absDefinition: { median: 0.695, spread: 0.196 },
  shoulderWaistRatio: { median: 1.961, spread: 0.326 },
  upperArmRatio: { median: 0.431, spread: 0.09 },
} as const;

/** 平均每项差距在这个档位距离以内算「最接近」，否则说成「练下去最可能成为」 */
export const BOJI_LOOKALIKE_CLOSE_DISTANCE = 0.5;

export interface BojiLookalikeMatch {
  key: string;
  name: string;
  groupLabel: string;
  tagline: string;
  /** close：身材已经接近；potential：差距较大，只是方向最接近 */
  closeness: 'close' | 'potential';
  /** 相似度 40–99，由档位距离换算，只用于展示 */
  similarity?: number;
  /** 第二接近的人物 */
  runnerUp?: string;
  /** 三项身材特点，如「腹肌清晰」「倒三角明显」「手臂偏细」 */
  traits?: string[];
  /** 头像路径（相对网站根目录）；没有授权照片的人物没有，前端显示姓名首字 */
  photoPath?: string;
  /** 头像署名，页面底部展示 */
  photoCredit?: string;
}

/** 头像的路径和署名；没有授权照片时返回空对象 */
export function bojiLookalikePhoto(key: string): Pick<BojiLookalikeMatch, 'photoPath' | 'photoCredit'> {
  const photo = BOJI_LOOKALIKE_PHOTOS[key];
  if (!photo) return {};
  return {
    photoPath: `/images/boji-lookalikes/${key}.webp`,
    photoCredit: `${photo.artist}，${photo.licence}，来自 Wikimedia Commons（已裁剪）`,
  };
}

export interface BojiLookalikeMeasures {
  absDefinition?: number | null;
  shoulderWaistRatio?: number | null;
  upperArmRatio?: number | null;
}

type Dimension = keyof BojiLookalikeTarget;
type Measure = keyof BojiLookalikeMeasures;

const DIMENSIONS: { key: Dimension; measure: Measure; low: string; mid: string; high: string }[] = [
  { key: 'abs', measure: 'absDefinition', low: '腹肌还不明显', mid: '腹肌中等', high: '腹肌清晰' },
  { key: 'vTaper', measure: 'shoulderWaistRatio', low: '倒三角偏弱', mid: '倒三角中等', high: '倒三角明显' },
  { key: 'arms', measure: 'upperArmRatio', low: '手臂偏细', mid: '手臂中等', high: '手臂粗壮' },
];

/** 档位超过半档算偏高或偏低 */
const TRAIT_THRESHOLD = 0.5;

/** 原始测量 → 连续档位，限制在 ±1.5 档，避免个别离谱值主导匹配 */
export function bojiLookalikeLevel(measure: Measure, value: number): number {
  const ref = BOJI_LOOKALIKE_REFERENCE[measure];
  return Math.max(-1.5, Math.min(1.5, (value - ref.median) / ref.spread));
}

/** 档位距离 → 展示用相似度：距离 0 为 99，每差一档约少 30，最低 40 */
export function bojiLookalikeSimilarity(distance: number): number {
  return Math.max(40, Math.min(99, Math.round(99 - 30 * distance)));
}

/** 至少要有两项可用的测量值才匹配；按档位均方根距离排序。 */
export function matchBojiLookalike(
  measures: BojiLookalikeMeasures,
  candidates: BojiLookalike[] = BOJI_LOOKALIKES,
): BojiLookalikeMatch | null {
  const levels: { dim: (typeof DIMENSIONS)[number]; level: number }[] = [];
  for (const dim of DIMENSIONS) {
    const v = measures[dim.measure];
    if (typeof v === 'number' && Number.isFinite(v)) levels.push({ dim, level: bojiLookalikeLevel(dim.measure, v) });
  }
  if (levels.length < 2 || candidates.length === 0) return null;

  const ranked = candidates
    .map((item) => {
      const squared = levels.reduce((sum, { dim, level }) => sum + (level - item.target[dim.key]) ** 2, 0);
      return { item, distance: Math.sqrt(squared / levels.length) };
    })
    .sort((a, b) => a.distance - b.distance);
  const [best, second] = ranked;

  return {
    key: best.item.key,
    name: best.item.name,
    groupLabel: BOJI_LOOKALIKE_GROUP_LABELS[best.item.group],
    tagline: best.item.tagline,
    closeness: best.distance <= BOJI_LOOKALIKE_CLOSE_DISTANCE ? 'close' : 'potential',
    similarity: bojiLookalikeSimilarity(best.distance),
    runnerUp: second?.item.name,
    traits: levels.map(({ dim, level }) =>
      level >= TRAIT_THRESHOLD ? dim.high : level <= -TRAIT_THRESHOLD ? dim.low : dim.mid,
    ),
    ...bojiLookalikePhoto(best.item.key),
  };
}
