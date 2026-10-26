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
import {
  BOJI_FEMALE_LOOKALIKE_GROUP_LABELS,
  BOJI_FEMALE_LOOKALIKES,
  type BojiFemaleLookalike,
} from './bojiFemaleLookalikeRoster';

export {
  BOJI_FEMALE_LOOKALIKE_GROUP_LABELS,
  BOJI_FEMALE_LOOKALIKES,
  type BojiFemaleLookalike,
  type BojiFemaleLookalikeGroup,
  type BojiFemaleLookalikeTarget,
} from './bojiFemaleLookalikeRoster';

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

interface RosterItem {
  key: string;
  name: string;
  tagline: string;
  groupLabel: string;
  target: Record<string, number>;
}

interface Level {
  key: string;
  level: number;
  trait: string;
}

/** 两份名单共用：按档位均方根距离排序，给出最接近、第二接近和身材特点。 */
function rankLookalikes(levels: Level[], candidates: RosterItem[]): BojiLookalikeMatch | null {
  if (levels.length < 2 || candidates.length === 0) return null;
  const ranked = candidates
    .map((item) => {
      const squared = levels.reduce((sum, { key, level }) => sum + (level - item.target[key]) ** 2, 0);
      return { item, distance: Math.sqrt(squared / levels.length) };
    })
    .sort((a, b) => a.distance - b.distance);
  const [best, second] = ranked;
  return {
    key: best.item.key,
    name: best.item.name,
    groupLabel: best.item.groupLabel,
    tagline: best.item.tagline,
    closeness: best.distance <= BOJI_LOOKALIKE_CLOSE_DISTANCE ? 'close' : 'potential',
    similarity: bojiLookalikeSimilarity(best.distance),
    runnerUp: second?.item.name,
    traits: levels.map((l) => l.trait),
    ...bojiLookalikePhoto(best.item.key),
  };
}

function traitFor(level: number, words: { low: string; mid: string; high: string }): string {
  return level >= TRAIT_THRESHOLD ? words.high : level <= -TRAIT_THRESHOLD ? words.low : words.mid;
}

/** 至少要有两项可用的测量值才匹配；按档位均方根距离排序。 */
export function matchBojiLookalike(
  measures: BojiLookalikeMeasures,
  candidates: BojiLookalike[] = BOJI_LOOKALIKES,
): BojiLookalikeMatch | null {
  const levels: Level[] = [];
  for (const dim of DIMENSIONS) {
    const v = measures[dim.measure];
    if (typeof v === 'number' && Number.isFinite(v)) {
      const level = bojiLookalikeLevel(dim.measure, v);
      levels.push({ key: dim.key, level, trait: traitFor(level, dim) });
    }
  }
  return rankLookalikes(
    levels,
    candidates.map((c) => ({ ...c, groupLabel: BOJI_LOOKALIKE_GROUP_LABELS[c.group], target: { ...c.target } })),
  );
}

// ---------------------------------------------------------------------------
// 女性档：马甲线、腰臀曲线、肩腰比
// ---------------------------------------------------------------------------

/**
 * 女性三项原始测量的参考水平。暂取 2026-10-26 引擎 0.2 在 20 张 CC0 女性健身照上的
 * 中位数和四分位距（IQR / 1.35）；女性真实检测攒够后按线上数据重算。
 */
export const BOJI_FEMALE_LOOKALIKE_REFERENCE = {
  absLineIndex: { median: 0.014, spread: 0.008 },
  waistHipRatio: { median: 0.7, spread: 0.06 },
  shoulderWaistRatio: { median: 1.72, spread: 0.12 },
} as const;

export interface BojiFemaleLookalikeMeasures {
  absLineIndex?: number | null;
  waistHipRatio?: number | null;
  shoulderWaistRatio?: number | null;
}

type FemaleMeasure = keyof BojiFemaleLookalikeMeasures;

/** sign：腰臀比越小曲线越明显，所以取反 */
const FEMALE_DIMENSIONS: { key: string; measure: FemaleMeasure; sign: 1 | -1; low: string; mid: string; high: string }[] = [
  { key: 'abs', measure: 'absLineIndex', sign: 1, low: '马甲线还不明显', mid: '马甲线隐约可见', high: '马甲线清晰' },
  { key: 'curve', measure: 'waistHipRatio', sign: -1, low: '腰臀曲线平直', mid: '腰臀曲线中等', high: '腰臀曲线明显' },
  { key: 'vTaper', measure: 'shoulderWaistRatio', sign: 1, low: '肩部偏窄', mid: '肩腰比例中等', high: '肩宽腰细' },
];

export function bojiFemaleLookalikeLevel(measure: FemaleMeasure, value: number, sign: 1 | -1 = 1): number {
  const ref = BOJI_FEMALE_LOOKALIKE_REFERENCE[measure];
  return Math.max(-1.5, Math.min(1.5, (sign * (value - ref.median)) / ref.spread));
}

export function matchBojiFemaleLookalike(
  measures: BojiFemaleLookalikeMeasures,
  candidates: BojiFemaleLookalike[] = BOJI_FEMALE_LOOKALIKES,
): BojiLookalikeMatch | null {
  const levels: Level[] = [];
  for (const dim of FEMALE_DIMENSIONS) {
    const v = measures[dim.measure];
    if (typeof v === 'number' && Number.isFinite(v)) {
      const level = bojiFemaleLookalikeLevel(dim.measure, v, dim.sign);
      levels.push({ key: dim.key, level, trait: traitFor(level, dim) });
    }
  }
  return rankLookalikes(
    levels,
    candidates.map((c) => ({ ...c, groupLabel: BOJI_FEMALE_LOOKALIKE_GROUP_LABELS[c.group], target: { ...c.target } })),
  );
}
