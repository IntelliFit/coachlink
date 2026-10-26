/**
 * 薄肌检测器「身材最像谁」。
 *
 * 用三项原始测量值匹配：腹肌清晰度（definition_index）、肩腰比、上臂宽/长。
 * 每项先和真实用户的中位水平比，换算成「偏低 / 中等 / 偏高」的连续档位，
 * 再取档位组合最接近的人物。每位人物占一种不同的高低组合，所以练得好的人
 * 也会按各自特点分散到不同人物上（2026-10-26 前按单项分匹配，单项分普遍接近
 * 满分，结果三成以上都是 CBum）。
 *
 * 名单和档位是运营配置，不是对本人照片的测量：改名单、改描述只需改这个文件。
 */

export type BojiLookalikeGroup = 'lean' | 'athlete' | 'muscle';

/** -1 偏低，0 中等，1 偏高 */
export type BojiLookalikeLevel = -1 | 0 | 1;

export interface BojiLookalikeTarget {
  abs: BojiLookalikeLevel;
  vTaper: BojiLookalikeLevel;
  arms: BojiLookalikeLevel;
}

export interface BojiLookalike {
  key: string;
  name: string;
  group: BojiLookalikeGroup;
  /** 一句话身材描述，显示在名字下面 */
  tagline: string;
  target: BojiLookalikeTarget;
}

export const BOJI_LOOKALIKE_GROUP_LABELS: Record<BojiLookalikeGroup, string> = {
  lean: '精瘦线条型',
  athlete: '运动员型',
  muscle: '大肌肉型',
};

const L = -1;
const M = 0;
const H = 1;

// target 顺序：腹肌清晰度、肩腰比（倒三角）、上臂粗细。组合两两不同。
export const BOJI_LOOKALIKES: BojiLookalike[] = [
  { key: 'bruce_lee', name: '李小龙', group: 'lean', tagline: '低围度、高线条，精瘦格斗型', target: { abs: H, vTaper: M, arms: L } },
  { key: 'brad_pitt', name: '布拉德·皮特', group: 'lean', tagline: '《搏击俱乐部》时期，腹肌清楚、整体精瘦', target: { abs: H, vTaper: L, arms: L } },
  { key: 'bai_jingting', name: '白敬亭', group: 'lean', tagline: '宽肩窄腰，穿衣显瘦脱衣有肉', target: { abs: L, vTaper: H, arms: L } },
  { key: 'tom_holland', name: '汤姆·赫兰德', group: 'lean', tagline: '灵活精干，体操运动感', target: { abs: M, vTaper: L, arms: M } },
  { key: 'beckham', name: '贝克汉姆', group: 'lean', tagline: '流线型足球运动员身材，围度适中', target: { abs: M, vTaper: M, arms: L } },
  { key: 'jackson_wang', name: '王嘉尔', group: 'lean', tagline: '偏精壮，舞台感强', target: { abs: M, vTaper: M, arms: M } },
  { key: 'usain_bolt', name: '尤塞恩·博尔特', group: 'athlete', tagline: '修长爆发，短跑运动员风格', target: { abs: L, vTaper: M, arms: L } },
  { key: 'cristiano_ronaldo', name: 'C罗', group: 'athlete', tagline: '腹部线条和全身肌肉都很均衡', target: { abs: H, vTaper: H, arms: M } },
  { key: 'michael_phelps', name: '迈克尔·菲尔普斯', group: 'athlete', tagline: '肩背发达，游泳运动员倒三角', target: { abs: L, vTaper: H, arms: M } },
  { key: 'eddie_peng', name: '彭于晏', group: 'athlete', tagline: '《激战》时期的精壮格斗身材', target: { abs: H, vTaper: M, arms: M } },
  { key: 'wu_lei', name: '吴磊', group: 'athlete', tagline: '青年运动型，紧致偏精瘦', target: { abs: L, vTaper: L, arms: L } },
  { key: 'mike_tyson', name: '迈克·泰森', group: 'athlete', tagline: '厚实有力的拳击体型', target: { abs: L, vTaper: M, arms: H } },
  { key: 'chris_heria', name: 'Chris Heria', group: 'muscle', tagline: '街头健身，腹肌明显、上肢发达', target: { abs: H, vTaper: M, arms: H } },
  { key: 'david_laid', name: 'David Laid', group: 'muscle', tagline: '健身审美型，宽肩窄腰', target: { abs: M, vTaper: H, arms: M } },
  { key: 'cbum', name: 'CBum', group: 'muscle', tagline: '古典健美，极强的 X 型比例', target: { abs: M, vTaper: H, arms: H } },
  { key: 'ronnie_coleman', name: '罗尼·库尔曼', group: 'muscle', tagline: '巨兽级健美体型', target: { abs: L, vTaper: H, arms: H } },
  { key: 'arnold', name: '阿诺·施瓦辛格', group: 'muscle', tagline: '经典健美，胸臂发达', target: { abs: H, vTaper: H, arms: H } },
  { key: 'henry_cavill', name: '亨利·卡维尔', group: 'muscle', tagline: '超级英雄电影里的厚实肌肉', target: { abs: M, vTaper: M, arms: H } },
  { key: 'chris_hemsworth', name: '克里斯·海姆斯沃斯', group: 'muscle', tagline: '胸肩臂突出的大肌肉电影体型', target: { abs: M, vTaper: L, arms: H } },
];

/**
 * 每项原始测量的「中等」和「偏高/偏低一档」的距离：取自 2026-10-25 线上
 * 114 次检测（48 人）的中位数和四分位距（IQR / 1.35）。
 */
export const BOJI_LOOKALIKE_REFERENCE = {
  absDefinition: { median: 0.695, spread: 0.196 },
  shoulderWaistRatio: { median: 1.961, spread: 0.326 },
  upperArmRatio: { median: 0.431, spread: 0.09 },
} as const;

/**
 * 平均每项差距在半档以内算「最接近」；落在没有人物占用的高低组合里（差距更大）
 * 时说成「练下去最可能成为」。
 */
export const BOJI_LOOKALIKE_CLOSE_DISTANCE = 0.5;

export interface BojiLookalikeMatch {
  key: string;
  name: string;
  groupLabel: string;
  tagline: string;
  /** close：身材已经接近；potential：差距较大，只是方向最接近 */
  closeness: 'close' | 'potential';
}

export interface BojiLookalikeMeasures {
  absDefinition?: number | null;
  shoulderWaistRatio?: number | null;
  upperArmRatio?: number | null;
}

type Dimension = keyof BojiLookalikeTarget;

const DIMENSIONS: { key: Dimension; measure: keyof BojiLookalikeMeasures }[] = [
  { key: 'abs', measure: 'absDefinition' },
  { key: 'vTaper', measure: 'shoulderWaistRatio' },
  { key: 'arms', measure: 'upperArmRatio' },
];

/** 原始测量 → 连续档位，限制在 ±1.5 档，避免个别离谱值主导匹配 */
export function bojiLookalikeLevel(measure: keyof BojiLookalikeMeasures, value: number): number {
  const ref = BOJI_LOOKALIKE_REFERENCE[measure];
  return Math.max(-1.5, Math.min(1.5, (value - ref.median) / ref.spread));
}

/** 至少要有两项可用的测量值才匹配；取档位均方根距离最小的一位。 */
export function matchBojiLookalike(
  measures: BojiLookalikeMeasures,
  candidates: BojiLookalike[] = BOJI_LOOKALIKES,
): BojiLookalikeMatch | null {
  const levels: { key: Dimension; level: number }[] = [];
  for (const { key, measure } of DIMENSIONS) {
    const v = measures[measure];
    if (typeof v === 'number' && Number.isFinite(v)) levels.push({ key, level: bojiLookalikeLevel(measure, v) });
  }
  if (levels.length < 2 || candidates.length === 0) return null;
  let best: { item: BojiLookalike; distance: number } | null = null;
  for (const item of candidates) {
    const squared = levels.reduce((sum, { key, level }) => sum + (level - item.target[key]) ** 2, 0);
    const distance = Math.sqrt(squared / levels.length);
    if (!best || distance < best.distance) best = { item, distance };
  }
  if (!best) return null;
  return {
    key: best.item.key,
    name: best.item.name,
    groupLabel: BOJI_LOOKALIKE_GROUP_LABELS[best.item.group],
    tagline: best.item.tagline,
    closeness: best.distance <= BOJI_LOOKALIKE_CLOSE_DISTANCE ? 'close' : 'potential',
  };
}
