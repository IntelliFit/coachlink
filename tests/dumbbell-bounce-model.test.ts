import { describe, expect, it } from 'vitest';
import {
  advanceSim,
  createRelease,
  createSim,
  PLATES,
  repsFromScene,
  seededRandom,
  simulateRound,
  WORLD_HEIGHT,
  type DumbbellBody
} from '../apps/wechat/src/toolbox/dumbbell-bounce/bounceModel';

const still = (overrides: Partial<DumbbellBody>): DumbbellBody => ({
  angle: 0,
  spin: 0,
  vx: 0,
  vy: 0,
  x: 0.5,
  y: WORLD_HEIGHT * 0.25,
  ...overrides
});

describe('dumbbell bounce physics', () => {
  it('drops straight through the gap when released upright in the middle', () => {
    const result = simulateRound(still({ angle: Math.PI / 2 }));
    expect(result.ended).toBe('fell');
    expect(result.hits).toBe(0);
  });

  it('bounces off a plate when released above its inner slope', () => {
    const leftPlate = PLATES.find((plate) => plate.side === 'left')!;
    const innerEdge = leftPlate.x + leftPlate.radius;
    const result = simulateRound(still({ x: innerEdge - 0.04 }));
    expect(result.ended).toBe('fell');
    expect(result.hits).toBeGreaterThan(0);
  });

  it('always ends on its own: every random release falls out within the time cap', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const result = simulateRound(createRelease(seededRandom(seed)));
      expect(result.ended).toBe('fell');
      expect(result.hits).toBeGreaterThanOrEqual(0);
      expect(result.seconds).toBeLessThan(10);
    }
  });

  it('gives different counts for different releases', () => {
    const counts = new Set<number>();
    for (let seed = 1; seed <= 100; seed += 1) {
      counts.add(simulateRound(createRelease(seededRandom(seed))).hits);
    }
    expect(counts.size).toBeGreaterThan(4);
  });

  it('is deterministic for the same release', () => {
    const release = createRelease(seededRandom(42));
    expect(simulateRound(release)).toEqual(simulateRound(release));
  });

  it('speed only fast-forwards time and does not change the physics', () => {
    const release = createRelease(seededRandom(7));
    const normal = advanceSim(createSim(release), 1200, 1);
    const doubled = advanceSim(createSim(release), 600, 2);
    expect(doubled.hits).toBe(normal.hits);
    expect(doubled.body.x).toBeCloseTo(normal.body.x, 9);
    expect(doubled.body.y).toBeCloseTo(normal.body.y, 9);
  });

  it('stops changing once the round has ended', () => {
    const release = createRelease(seededRandom(3));
    let sim = createSim(release);
    while (!sim.ended) sim = advanceSim(sim, 1000);
    expect(advanceSim(sim, 5000)).toBe(sim);
  });

  it('only reports reps once the dumbbell has been released', () => {
    expect(repsFromScene({ hits: 0, status: 'idle' })).toBeNull();
    expect(repsFromScene({ hits: 0, status: 'countdown' })).toBeNull();
    expect(repsFromScene({ hits: 3, status: 'bouncing' })).toBe(3);
    expect(repsFromScene({ hits: 0, status: 'result' })).toBe(0);
  });
});
