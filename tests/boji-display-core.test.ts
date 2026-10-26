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
      weakest: { key: 'arms', label: '手臂', score: 65 },
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

describe('female profile', () => {
  const female = { abs: 70, v_taper: 80, arms: 99, symmetry: 75, waist_hip: 60 };

  it('ignores arms and names metrics the female way', () => {
    expect(bojiStrengths(female, 'female')).toEqual({
      best: { key: 'v_taper', label: '肩腰比', score: 80 },
      weakest: { key: 'waist_hip', label: '腰臀比', score: 60 },
    });
    expect(bojiTrainingTip(bojiStrengths(female, 'female'), 'female')).toContain('臀');
    expect(bojiTrainingTip(bojiStrengths({ ...female, abs: 10 }, 'female'), 'female')).toContain('马甲线');
  });

  it('puts waist/hip on the radar instead of arms', () => {
    const axes = bojiRadarAxes(female, 100, 100, 80, 'female');
    expect(axes.map((a) => a.label)).toEqual(['马甲线', '腰臀比', '肩腰比', '对称']);
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
