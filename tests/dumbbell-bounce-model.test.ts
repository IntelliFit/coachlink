import { describe, expect, it } from 'vitest';
import {
  advanceSim,
  createRelease,
  createRound,
  createSim,
  DEFAULT_TUNING,
  MAX_HITS,
  PLATES,
  repsFromScene,
  runToEnd,
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

  it('cannot fall through the gap lying flat, so it bounces off the plates', () => {
    const leftPlate = PLATES.find((plate) => plate.side === 'left')!;
    const rightPlate = PLATES.find((plate) => plate.side === 'right')!;
    const gap = (rightPlate.x - rightPlate.radius) - (leftPlate.x + leftPlate.radius);
    expect(gap).toBeLessThan(0.26);

    let sim = createSim(still({ angle: 0 }), DEFAULT_TUNING, 0);
    sim = advanceSim(sim, 3000);
    expect(sim.hits).toBeGreaterThan(0);
  });

  it('never bounces higher than where it was released (energy is conserved)', () => {
    const release = createRelease(seededRandom(11));
    const kinetic = 0.5 * (release.vx ** 2 + release.vy ** 2);
    // 平动动能全转成高度的上限；转动动能只会让上限更高一点，这里留出余量。
    const highestPossible = release.y - kinetic / DEFAULT_TUNING.gravity - 0.05;
    let sim = createSim(release, DEFAULT_TUNING, 0.2);
    let minY = sim.body.y;
    for (let i = 0; i < 600 && !sim.ended; i += 1) {
      sim = advanceSim(sim, 50);
      minY = Math.min(minY, sim.body.y);
    }
    expect(minY).toBeGreaterThan(highestPossible);
  });

  it('spreads results from a handful to hundreds and occasionally thousands', () => {
    const hits: number[] = [];
    for (let seed = 1; seed <= 300; seed += 1) {
      const result = runToEnd(createRound(seededRandom(seed)));
      expect(['fell', 'stuck', 'timeout']).toContain(result.ended);
      expect(result.hits).toBeLessThanOrEqual(MAX_HITS);
      hits.push(result.hits);
    }
    expect(hits.filter((h) => h < 10).length).toBeGreaterThan(10);
    expect(hits.filter((h) => h >= 10 && h < 100).length).toBeGreaterThan(60);
    expect(hits.filter((h) => h >= 100).length).toBeGreaterThan(60);
    expect(Math.max(...hits)).toBeGreaterThanOrEqual(1000);
  });

  it('is deterministic for the same release and friction', () => {
    const release = createRelease(seededRandom(42));
    expect(simulateRound(release, DEFAULT_TUNING, 0.1)).toEqual(simulateRound(release, DEFAULT_TUNING, 0.1));
  });

  it('speed only fast-forwards time and does not change the physics', () => {
    const start = createRound(seededRandom(7));
    const normal = advanceSim(start, 4000, 1);
    const tenTimes = advanceSim(start, 400, 10);
    expect(tenTimes.hits).toBe(normal.hits);
    expect(tenTimes.body.x).toBeCloseTo(normal.body.x, 9);
    expect(tenTimes.body.y).toBeCloseTo(normal.body.y, 9);
  });

  it('stops changing once the round has ended', () => {
    let sim = createSim(still({ angle: Math.PI / 2 }));
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
