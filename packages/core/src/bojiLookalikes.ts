/**
 * 薄肌检测器「身材最像谁」：每位人物配一组目标分数（腹肌、倒三角、手臂，0–100，
 * 与检测结果的单项分同一刻度），检测完取距离最近的一位。
 *
 * 名单和目标分是运营配置，不是对本人照片的测量：改名单、改描述只需改这个文件。
 * 2026-10-25 首版取自运营给的名单（精瘦线条 / 运动员 / 大肌肉三组）。
 */

export type BojiLookalikeGroup = 'lean' | 'athlete' | 'muscle';

export interface BojiLookalikeTarget {
  abs: number;
  vTaper: number;
  arms: number;
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

export const BOJI_LOOKALIKES: BojiLookalike[] = [
  { key: 'bruce_lee', name: '李小龙', group: 'lean', tagline: '低围度、高线条，精瘦格斗型', target: { abs: 95, vTaper: 85, arms: 45 } },
  { key: 'brad_pitt', name: '布拉德·皮特', group: 'lean', tagline: '《搏击俱乐部》时期，腹肌清楚、整体精瘦', target: { abs: 90, vTaper: 75, arms: 50 } },
  { key: 'bai_jingting', name: '白敬亭', group: 'lean', tagline: '宽肩窄腰，穿衣显瘦脱衣有肉', target: { abs: 70, vTaper: 85, arms: 45 } },
  { key: 'tom_holland', name: '汤姆·赫兰德', group: 'lean', tagline: '灵活精干，体操运动感', target: { abs: 85, vTaper: 70, arms: 55 } },
  { key: 'beckham', name: '贝克汉姆', group: 'lean', tagline: '流线型足球运动员身材，围度适中', target: { abs: 75, vTaper: 70, arms: 55 } },
  { key: 'jackson_wang', name: '王嘉尔', group: 'lean', tagline: '偏精壮，舞台感强', target: { abs: 80, vTaper: 75, arms: 65 } },
  { key: 'usain_bolt', name: '尤塞恩·博尔特', group: 'athlete', tagline: '修长爆发，短跑运动员风格', target: { abs: 70, vTaper: 80, arms: 55 } },
  { key: 'cristiano_ronaldo', name: 'C罗', group: 'athlete', tagline: '腹部线条和全身肌肉都很均衡', target: { abs: 95, vTaper: 85, arms: 70 } },
  { key: 'michael_phelps', name: '迈克尔·菲尔普斯', group: 'athlete', tagline: '肩背发达，游泳运动员倒三角', target: { abs: 75, vTaper: 98, arms: 60 } },
  { key: 'eddie_peng', name: '彭于晏', group: 'athlete', tagline: '《激战》时期的精壮格斗身材', target: { abs: 90, vTaper: 85, arms: 75 } },
  { key: 'wu_lei', name: '吴磊', group: 'athlete', tagline: '青年运动型，紧致偏精瘦', target: { abs: 70, vTaper: 65, arms: 50 } },
  { key: 'mike_tyson', name: '迈克·泰森', group: 'athlete', tagline: '厚实有力的拳击体型', target: { abs: 55, vTaper: 75, arms: 95 } },
  { key: 'chris_heria', name: 'Chris Heria', group: 'muscle', tagline: '街头健身，腹肌明显、上肢发达', target: { abs: 92, vTaper: 88, arms: 85 } },
  { key: 'david_laid', name: 'David Laid', group: 'muscle', tagline: '健身审美型，宽肩窄腰', target: { abs: 88, vTaper: 95, arms: 80 } },
  { key: 'cbum', name: 'CBum', group: 'muscle', tagline: '古典健美，极强的 X 型比例', target: { abs: 85, vTaper: 100, arms: 95 } },
  { key: 'ronnie_coleman', name: '罗尼·库尔曼', group: 'muscle', tagline: '巨兽级健美体型', target: { abs: 70, vTaper: 90, arms: 100 } },
  { key: 'arnold', name: '阿诺·施瓦辛格', group: 'muscle', tagline: '经典健美，胸臂发达', target: { abs: 80, vTaper: 95, arms: 100 } },
  { key: 'henry_cavill', name: '亨利·卡维尔', group: 'muscle', tagline: '超级英雄电影里的厚实肌肉', target: { abs: 75, vTaper: 85, arms: 85 } },
  { key: 'chris_hemsworth', name: '克里斯·海姆斯沃斯', group: 'muscle', tagline: '胸肩臂突出的大肌肉电影体型', target: { abs: 70, vTaper: 85, arms: 92 } },
];

/** 平均每项差距在这个分数以内算「最接近」，否则说成「练下去最可能成为」 */
export const BOJI_LOOKALIKE_CLOSE_DISTANCE = 12;

export interface BojiLookalikeMatch {
  key: string;
  name: string;
  groupLabel: string;
  tagline: string;
  /** close：身材已经接近；potential：差距较大，只是方向最接近 */
  closeness: 'close' | 'potential';
}

export type BojiLookalikeScores = Partial<Record<keyof BojiLookalikeTarget, number | null>>;

/** 至少要有两项可用的单项分才匹配；取均方根距离最小的一位。 */
export function matchBojiLookalike(
  scores: BojiLookalikeScores,
  candidates: BojiLookalike[] = BOJI_LOOKALIKES,
): BojiLookalikeMatch | null {
  const keys = (['abs', 'vTaper', 'arms'] as const).filter((k) => {
    const v = scores[k];
    return typeof v === 'number' && Number.isFinite(v);
  });
  if (keys.length < 2 || candidates.length === 0) return null;
  let best: { item: BojiLookalike; distance: number } | null = null;
  for (const item of candidates) {
    const squared = keys.reduce((sum, k) => sum + (Number(scores[k]) - item.target[k]) ** 2, 0);
    const distance = Math.sqrt(squared / keys.length);
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
