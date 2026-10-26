import { describe, expect, it } from 'vitest';
import type { BojiMetric, BojiReport } from '../packages/core/src/bojiDetector';
import {
  BOJI_PERCENTILE_MIN_REAL_USERS,
  bojiDuelHeadline,
  bojiLookalikeText,
  bojiPercentile,
  bojiScoreSnapshot,
  bojiShareTitle,
  compareBojiScores,
  estimateBojiPercentile,
  isBojiScoreId,
  isRecordableBojiSnapshot,
  lookalikeForSnapshot,
  type BojiMetricScores,
} from '../packages/core/src/bojiInsights';
import {
  BOJI_LOOKALIKE_REFERENCE,
  BOJI_LOOKALIKES,
  bojiLookalikeLevel,
  matchBojiLookalike,
  type BojiLookalikeTarget,
} from '../packages/core/src/bojiLookalikes';

/** 把档位换回原始测量值，方便构造「正好是某位人物」的身材 */
function measuresAt(target: BojiLookalikeTarget) {
  const at = (ref: { median: number; spread: number }, level: number) => ref.median + level * ref.spread;
  return {
    absDefinition: at(BOJI_LOOKALIKE_REFERENCE.absDefinition, target.abs),
    shoulderWaistRatio: at(BOJI_LOOKALIKE_REFERENCE.shoulderWaistRatio, target.vTaper),
    upperArmRatio: at(BOJI_LOOKALIKE_REFERENCE.upperArmRatio, target.arms),
  };
}

function metric(key: BojiMetric['key'], patch: Partial<BojiMetric> = {}): BojiMetric {
  return { key, status: 'ok', score: 80, values: {}, reasons: [], geometry: {}, ...patch };
}

function report(patch: Partial<BojiReport> = {}): BojiReport {
  return {
    version: '0.1.1',
    image_size: [800, 1000],
    deskew_deg: 0,
    quality: [],
    metrics: {
      abs: metric('abs', { score: 91.26, values: { pack_count: 6, definition_index: 0.81 } }),
      v_taper: metric('v_taper', { score: 88.04, values: { ratio: 1.86 } }),
      arms: metric('arms', { score: 64.5, values: { upper_ratio: 0.36 } }),
      symmetry: metric('symmetry', { status: 'unavailable', score: 40, values: { silhouette_iou: 0.7 } }),
    },
    total: { score: 82.44, weights_used: {}, missing: ['symmetry'], calibration: 'uncalibrated-v0' },
    to_original: [[1, 0, 0], [0, 1, 0]],
    original_size: null,
    ...patch,
  };
}

const scores = (abs: number | null, v: number | null, arms: number | null, sym: number | null): BojiMetricScores => ({
  abs,
  v_taper: v,
  arms,
  symmetry: sym,
});

describe('bojiScoreSnapshot', () => {
  it('keeps usable scores rounded to one decimal and drops unavailable metrics', () => {
    const snap = bojiScoreSnapshot(report());
    expect(snap.total).toBe(82.4);
    expect(snap.scores).toEqual(scores(91.3, 88, 64.5, null));
    expect(snap.shoulderWaistRatio).toBe(1.86);
    expect(snap.upperArmRatio).toBe(0.36);
    expect(snap.absPackCount).toBe(6);
    expect(snap.silhouetteIou).toBeNull();
    expect(isRecordableBojiSnapshot(snap)).toBe(true);
  });

  it('tolerates a report without metrics or total', () => {
    const snap = bojiScoreSnapshot({ metrics: {} } as unknown as BojiReport);
    expect(snap.total).toBeNull();
    expect(isRecordableBojiSnapshot(snap)).toBe(false);
    expect(bojiScoreSnapshot(undefined).scores).toEqual(scores(null, null, null, null));
  });
});

describe('bojiPercentile', () => {
  it('estimates from the prior distribution until enough real users exist', () => {
    expect(estimateBojiPercentile(78)).toBe(50);
    expect(estimateBojiPercentile(95)).toBeGreaterThan(80);
    expect(estimateBojiPercentile(55)).toBeLessThan(15);
    expect(estimateBojiPercentile(-50)).toBe(1);
    expect(estimateBojiPercentile(500)).toBe(99);
    const p = bojiPercentile(71, { sampleUsers: 12, belowUsers: 11 });
    expect(p).toEqual({ value: estimateBojiPercentile(71), basis: 'estimate', sampleUsers: 12 });
  });

  it('switches to the measured distribution at the threshold', () => {
    const n = BOJI_PERCENTILE_MIN_REAL_USERS;
    expect(bojiPercentile(60, { sampleUsers: n, belowUsers: 30 })).toEqual({ value: 30, basis: 'measured', sampleUsers: n });
    expect(bojiPercentile(60, { sampleUsers: n, belowUsers: n })?.value).toBe(99);
    expect(bojiPercentile(60, { sampleUsers: n, belowUsers: 0 })?.value).toBe(1);
  });

  it('returns null without a total and falls back to the estimate without a sample', () => {
    expect(bojiPercentile(null, { sampleUsers: 500, belowUsers: 1 })).toBeNull();
    expect(bojiPercentile(78, null)).toEqual({ value: 50, basis: 'estimate', sampleUsers: 0 });
  });
});

describe('lookalikes', () => {
  it('uses unique keys and a distinct level combination per person', () => {
    expect(BOJI_LOOKALIKES.length).toBeGreaterThanOrEqual(50);
    expect(new Set(BOJI_LOOKALIKES.map((l) => l.key)).size).toBe(BOJI_LOOKALIKES.length);
    const steps = [-1.5, -1, -0.5, 0, 0.5, 1, 1.5];
    for (const l of BOJI_LOOKALIKES) {
      for (const v of Object.values(l.target)) expect(steps).toContain(v);
    }
    const combos = BOJI_LOOKALIKES.map((l) => `${l.target.abs},${l.target.vTaper},${l.target.arms}`);
    expect(new Set(combos).size).toBe(BOJI_LOOKALIKES.length);
  });

  it('matches an exact target as close, with similarity, runner-up and traits', () => {
    const lee = BOJI_LOOKALIKES.find((l) => l.key === 'bruce_lee')!;
    const match = matchBojiLookalike(measuresAt(lee.target));
    expect(match).toMatchObject({ key: 'bruce_lee', closeness: 'close', groupLabel: '精瘦线条型', similarity: 99 });
    expect(match?.runnerUp).toBeTruthy();
    expect(match?.runnerUp).not.toBe('李小龙');
    // 李小龙：腹肌 1.5 档、倒三角 0.5 档、手臂 -1 档
    expect(match?.traits).toEqual(['腹肌清晰', '倒三角明显', '手臂偏细']);
  });

  it('words a distant match as potential', () => {
    const only = [{ ...BOJI_LOOKALIKES[0], target: { abs: 1.5, vTaper: 1.5, arms: 1.5 } }];
    const far = matchBojiLookalike(measuresAt({ abs: -1, vTaper: -1, arms: -1 }), only);
    expect(far?.closeness).toBe('potential');
    expect(far?.similarity).toBe(40);
    expect(far?.runnerUp).toBeUndefined();
  });

  it('describes middle levels as medium', () => {
    expect(matchBojiLookalike(measuresAt({ abs: 0, vTaper: 0, arms: 0 }))?.traits).toEqual(['腹肌中等', '倒三角中等', '手臂中等']);
    expect(matchBojiLookalike({ absDefinition: 0.2, upperArmRatio: 0.6 })?.traits).toEqual(['腹肌还不明显', '手臂粗壮']);
  });

  it('spreads people who all score highly instead of matching one person', () => {
    // 同样练得很好的两个人：一个手臂特别粗，一个倒三角特别明显
    const bigArms = matchBojiLookalike({ absDefinition: 0.9, shoulderWaistRatio: 1.96, upperArmRatio: 0.55 });
    const wideShoulders = matchBojiLookalike({ absDefinition: 0.7, shoulderWaistRatio: 2.4, upperArmRatio: 0.43 });
    expect(bigArms?.key).not.toBe(wideShoulders?.key);
  });

  it('clamps outliers to one and a half levels', () => {
    expect(bojiLookalikeLevel('upperArmRatio', 5)).toBe(1.5);
    expect(bojiLookalikeLevel('shoulderWaistRatio', 0)).toBe(-1.5);
  });

  it('needs at least two usable measures', () => {
    expect(matchBojiLookalike({ absDefinition: 0.9, shoulderWaistRatio: null, upperArmRatio: null })).toBeNull();
    expect(matchBojiLookalike({ absDefinition: 0.9, shoulderWaistRatio: 2 })).not.toBeNull();
    expect(lookalikeForSnapshot(bojiScoreSnapshot(report()))).not.toBeNull();
  });

  it('words the match by closeness', () => {
    expect(bojiLookalikeText({ key: 'k', name: '李小龙', groupLabel: '', tagline: '', closeness: 'close' })).toContain('最接近：李小龙');
    expect(bojiLookalikeText({ key: 'k', name: '李小龙', groupLabel: '', tagline: '', closeness: 'potential' })).toContain('最可能成为：李小龙');
    expect(bojiLookalikeText(null)).toBe('');
  });
});

describe('compareBojiScores', () => {
  it('counts wins per metric and skips metrics either side lacks', () => {
    const duel = compareBojiScores(
      { total: 80, scores: scores(90, 70, 60.4, null) },
      { total: 75, scores: scores(85, 80, 60.2, 90) },
    );
    expect(duel.lines.map((l) => l.outcome)).toEqual(['win', 'lose', 'tie', null]);
    expect(duel).toMatchObject({ wins: 1, losses: 1, ties: 1 });
    expect(duel.overall).toBe('win');
    expect(bojiDuelHeadline(duel)).toBe('你赢了！1 胜 1 负 1 平');
  });

  it('decides on metric wins before the total', () => {
    const duel = compareBojiScores(
      { total: 60, scores: scores(90, 90, 10, 10) },
      { total: 70, scores: scores(80, 80, 20, 5) },
    );
    expect(duel.overall).toBe('win');
    expect(bojiDuelHeadline(compareBojiScores(
      { total: 60, scores: scores(80, null, null, null) },
      { total: 60, scores: scores(80, null, null, null) },
    ))).toBe('打平了，0 胜 0 负 1 平');
  });
});

describe('helpers', () => {
  it('builds the share title', () => {
    expect(bojiShareTitle(82.4, { value: 93, basis: 'estimate', sampleUsers: 0 })).toBe('我的薄肌综合 82 分，超越了约 93% 的人，敢来 PK 吗？');
    expect(bojiShareTitle(null, null)).toContain('PK');
  });

  it('validates score ids', () => {
    expect(isBojiScoreId('3f2b1c4d-1111-4a2b-8c3d-1234567890ab')).toBe(true);
    expect(isBojiScoreId("1' or 1=1")).toBe(false);
    expect(isBojiScoreId(undefined)).toBe(false);
  });
});

describe('lookalike photos', () => {
  it('only references avatars that exist and every photo has a credit', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { BOJI_LOOKALIKE_PHOTOS } = await import('../packages/core/src/bojiLookalikePhotos');
    const { bojiLookalikePhoto } = await import('../packages/core/src/bojiLookalikes');
    const keys = new Set(BOJI_LOOKALIKES.map((l) => l.key));
    for (const [key, photo] of Object.entries(BOJI_LOOKALIKE_PHOTOS)) {
      expect(keys.has(key)).toBe(true);
      expect(photo.artist.length).toBeGreaterThan(1);
      expect(photo.licence).toMatch(/^(CC BY|CC0|Public domain)/i);
      expect(photo.licence).not.toMatch(/NC|ND/);
      const file = path.join(__dirname, '..', 'public', bojiLookalikePhoto(key).photoPath!);
      expect(fs.existsSync(file)).toBe(true);
    }
  });

  it('falls back to no photo for people without a licensed portrait', async () => {
    const { bojiLookalikePhoto } = await import('../packages/core/src/bojiLookalikes');
    expect(bojiLookalikePhoto('wang_yibo')).toEqual({});
    expect(bojiLookalikePhoto('bruce_lee').photoCredit).toContain('Wikimedia Commons');
  });
});
