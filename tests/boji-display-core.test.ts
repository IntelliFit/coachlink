import { describe, expect, it } from 'vitest';
import {
  bojiChallengeScene,
  bojiRadarAxes,
  bojiRingArc,
  bojiScoreIdFromScene,
  bojiStrengths,
  bojiTrainingTip,
} from '../packages/core/src/bojiDisplay';
import type { BojiMetricScores } from '../packages/core/src/bojiInsights';

const scores = (abs: number | null, v: number | null, arms: number | null, sym: number | null): BojiMetricScores => ({
  abs,
  v_taper: v,
  arms,
  symmetry: sym,
});

describe('bojiStrengths', () => {
  it('picks the best and weakest measured metric', () => {
    expect(bojiStrengths(scores(91.3, 88, 64.6, 80))).toEqual({
      best: { key: 'abs', label: '腹肌', score: 91 },
      weakest: { key: 'arms', label: '手臂围度', score: 65 },
    });
  });

  it('ignores unmeasured metrics and needs two different ones', () => {
    expect(bojiStrengths(scores(null, 70, null, 90))?.weakest.key).toBe('v_taper');
    expect(bojiStrengths(scores(80, null, null, null))).toBeNull();
    expect(bojiStrengths(scores(80, 80, null, null))).toBeNull();
  });

  it('gives a training tip for the weakest metric', () => {
    expect(bojiTrainingTip(bojiStrengths(scores(91, 88, 65, 80)))).toContain('手臂');
    expect(bojiTrainingTip(null)).toBe('');
  });
});

describe('geometry', () => {
  it('places radar points on up/right/down/left axes', () => {
    const axes = bojiRadarAxes(scores(100, 50, 0, null), 100, 100, 80);
    expect(axes.map((a) => a.key)).toEqual(['abs', 'v_taper', 'arms', 'symmetry']);
    expect(axes[0].point).toEqual([100, 20]);
    expect(axes[1].point).toEqual([140, 100]);
    expect(axes[2].point).toEqual([100, 100]);
    expect(axes[3]).toMatchObject({ score: null, point: [100, 100], end: [20, 100] });
  });

  it('clamps the ring fraction', () => {
    expect(bojiRingArc(82, 56).fraction).toBeCloseTo(0.82);
    expect(bojiRingArc(150, 56).fraction).toBe(1);
    expect(bojiRingArc(null, 56)).toMatchObject({ filled: 0, fraction: 0 });
  });
});

describe('challenge scene', () => {
  const id = '3f2b1c4d-1111-4a2b-8c3d-1234567890ab';

  it('round-trips a score id through the 32-character scene', () => {
    const scene = bojiChallengeScene(id);
    expect(scene).toHaveLength(32);
    expect(bojiScoreIdFromScene(scene)).toBe(id);
    expect(bojiScoreIdFromScene(encodeURIComponent(scene))).toBe(id);
  });

  it('rejects anything else', () => {
    expect(bojiScoreIdFromScene('abc')).toBeNull();
    expect(bojiScoreIdFromScene(undefined)).toBeNull();
    expect(bojiScoreIdFromScene('z'.repeat(32))).toBeNull();
  });
});
