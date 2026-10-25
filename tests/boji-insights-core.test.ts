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
import { BOJI_LOOKALIKES, matchBojiLookalike } from '../packages/core/src/bojiLookalikes';

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
    expect(estimateBojiPercentile(55)).toBe(50);
    expect(estimateBojiPercentile(80)).toBeGreaterThan(90);
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
    expect(bojiPercentile(55, null)).toEqual({ value: 50, basis: 'estimate', sampleUsers: 0 });
  });
});

describe('lookalikes', () => {
  it('uses unique keys and in-range targets', () => {
    expect(new Set(BOJI_LOOKALIKES.map((l) => l.key)).size).toBe(BOJI_LOOKALIKES.length);
    for (const l of BOJI_LOOKALIKES) {
      for (const v of Object.values(l.target)) expect(v).toBeGreaterThanOrEqual(0);
      for (const v of Object.values(l.target)) expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('matches an exact target as close and a distant profile as potential', () => {
    const lee = BOJI_LOOKALIKES.find((l) => l.key === 'bruce_lee')!;
    expect(matchBojiLookalike(lee.target)).toMatchObject({ key: 'bruce_lee', closeness: 'close', groupLabel: '精瘦线条型' });
    const far = matchBojiLookalike({ abs: 10, vTaper: 30, arms: 20 });
    expect(far?.closeness).toBe('potential');
  });

  it('needs at least two usable scores', () => {
    expect(matchBojiLookalike({ abs: 90, vTaper: null, arms: null })).toBeNull();
    expect(matchBojiLookalike({ abs: 90, vTaper: 85 })).not.toBeNull();
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
