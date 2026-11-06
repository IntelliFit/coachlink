import { describe, expect, it } from 'vitest';
import {
  HEAD_TRAVEL_DEFAULTS,
  HEAD_TRAVEL_IN_ROUND,
  mapHeadTravelToStage,
  updateHeadTravel,
  type HeadTravelRange
} from '../apps/wechat/src/toolbox/games/headTravelMapper';

function feedReps(samples: number[], stepMs = 50) {
  let range: HeadTravelRange | null = null;
  samples.forEach((y, index) => {
    range = updateHeadTravel(range, y, index * stepMs);
  });
  return range as HeadTravelRange | null;
}

function repCycle(top: number, bottom: number, steps = 20) {
  return Array.from({ length: steps }, (_, i) => {
    const phase = (Math.cos((i / steps) * Math.PI * 2) + 1) / 2;
    return bottom + (top - bottom) * (1 - phase);
  });
}

describe('head travel mapper', () => {
  it('maps the first sample to the stage center', () => {
    const range = updateHeadTravel(null, 0.62, 0);
    expect(mapHeadTravelToStage(range, 0.62)).toBeCloseTo(0.5);
  });

  it('maps the middle of a small pull-up stroke to the screen center', () => {
    // 头部只在画面 40%–58% 之间移动（行程 18%）。
    const samples = [...repCycle(0.4, 0.58), ...repCycle(0.4, 0.58)];
    const range = feedReps(samples);
    expect(mapHeadTravelToStage(range, 0.49)).toBeCloseTo(0.5, 1);
  });

  it('lets a full stroke reach the upper and lower lanes', () => {
    const samples = [...repCycle(0.36, 0.6), ...repCycle(0.36, 0.6)];
    const range = feedReps(samples);
    expect(mapHeadTravelToStage(range, 0.36)).toBeLessThanOrEqual(0.16);
    expect(mapHeadTravelToStage(range, 0.6)).toBeGreaterThanOrEqual(0.84);
  });

  it('caps the gain so small head jitter is not blown up', () => {
    const range = feedReps([...repCycle(0.45, 0.5), ...repCycle(0.45, 0.5)]);
    const gain = (mapHeadTravelToStage(range, 0.49) - mapHeadTravelToStage(range, 0.47)) / 0.02;
    expect(gain).toBeLessThanOrEqual(HEAD_TRAVEL_DEFAULTS.playSpan / 0.24 + 1e-9);
  });

  it('keeps the mapping fixed during a round: the range only grows', () => {
    let range: HeadTravelRange | null = feedReps([...repCycle(0.3, 0.6), ...repCycle(0.3, 0.6)]);
    const before = mapHeadTravelToStage(range, 0.45);
    for (let t = 0; t < 30_000; t += 50) {
      range = updateHeadTravel(range, 0.45, 2_000 + t, HEAD_TRAVEL_IN_ROUND);
    }
    expect(mapHeadTravelToStage(range, 0.45)).toBeCloseTo(before, 6);
    range = updateHeadTravel(range, 0.2, 40_000, HEAD_TRAVEL_IN_ROUND);
    expect((range as HeadTravelRange).low).toBe(0.2);
  });

  it('does not over-amplify jitter while the user is still', () => {
    const range = feedReps([0.5, 0.502, 0.498, 0.501]);
    const jitter = Math.abs(mapHeadTravelToStage(range, 0.505) - mapHeadTravelToStage(range, 0.5));
    expect(jitter).toBeLessThanOrEqual(
      (0.005 / HEAD_TRAVEL_DEFAULTS.minRange) * HEAD_TRAVEL_DEFAULTS.playSpan + 1e-9
    );
  });

  it('slowly re-centers after the user changes position', () => {
    let range: HeadTravelRange | null = feedReps([...repCycle(0.3, 0.5), ...repCycle(0.3, 0.5)]);
    for (let t = 0; t < 40_000; t += 50) {
      range = updateHeadTravel(range, 0.7, 2_000 + t);
    }
    expect(mapHeadTravelToStage(range, 0.7)).toBeCloseTo(0.5, 1);
  });

  it('clamps output inside the stage', () => {
    const range = feedReps(repCycle(0.4, 0.58));
    expect(mapHeadTravelToStage(range, -1)).toBeGreaterThan(0);
    expect(mapHeadTravelToStage(range, 2)).toBeLessThan(1);
  });
});
