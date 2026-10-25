import { describe, expect, it } from 'vitest';
import {
  advancePhase,
  BASE_HITS_PER_SECOND,
  dumbbellPose,
  hitCount,
  repsFromScene,
  START_PHASE
} from '../apps/wechat/src/toolbox/dumbbell-bounce/bounceModel';

describe('dumbbell bounce model', () => {
  it('starts between the plates with zero hits', () => {
    expect(hitCount(START_PHASE)).toBe(0);
    expect(dumbbellPose(START_PHASE).progress).toBeCloseTo(0.5);
    expect(dumbbellPose(START_PHASE).impactSide).toBeNull();
  });

  it('bounces at a constant rate that only the chosen speed changes', () => {
    const oneSecondAt1x = advancePhase(0, 1000, 1);
    expect(oneSecondAt1x).toBeCloseTo(BASE_HITS_PER_SECOND);
    // 同样一秒，前半秒和后半秒走的距离一样（不会自己加速）。
    expect(advancePhase(0, 500, 1)).toBeCloseTo(oneSecondAt1x - advancePhase(0, 500, 1));
    expect(advancePhase(0, 1000, 2)).toBeCloseTo(oneSecondAt1x * 2);
    expect(advancePhase(0, 1000, 3)).toBeCloseTo(oneSecondAt1x * 3);
  });

  it('ignores negative frame deltas', () => {
    expect(advancePhase(3.2, -40, 1)).toBe(3.2);
  });

  it('counts one rep per plate hit and alternates sides', () => {
    expect(hitCount(0.99)).toBe(0);
    expect(hitCount(1)).toBe(1);
    expect(hitCount(7.4)).toBe(7);

    // 第 1 次撞右片后往左飞，第 2 次撞左片后往右飞。
    const afterFirst = dumbbellPose(1.02);
    expect(afterFirst.impactSide).toBe('right');
    expect(afterFirst.progress).toBeGreaterThan(0.9);
    const afterSecond = dumbbellPose(2.02);
    expect(afterSecond.impactSide).toBe('left');
    expect(afterSecond.progress).toBeLessThan(0.1);
    expect(dumbbellPose(2.5).impact).toBe(0);
  });

  it('only reports reps once the round is bouncing or finished', () => {
    expect(repsFromScene({ phase: START_PHASE, status: 'idle' })).toBeNull();
    expect(repsFromScene({ phase: START_PHASE, status: 'countdown' })).toBeNull();
    expect(repsFromScene({ phase: 4.7, status: 'bouncing' })).toBe(4);
    expect(repsFromScene({ phase: 12.1, status: 'result' })).toBe(12);
    expect(repsFromScene({ phase: START_PHASE, status: 'result' })).toBe(0);
  });
});
