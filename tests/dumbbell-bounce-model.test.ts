import { describe, expect, it } from 'vitest';
import {
  advanceSim,
  createRound,
  MAX_HITS,
  PLATES,
  repsFromScene,
  rollTargetHits,
  runToEnd,
  seededRandom,
  type BounceSim
} from '../apps/wechat/src/toolbox/dumbbell-bounce/bounceModel';

const STEP_MS = 1000 / 240;

function playRound(seed: number, targetHits: number, onStep: (sim: BounceSim) => void) {
  let sim = createRound(seededRandom(seed), targetHits);
  while (!sim.ended) {
    sim = advanceSim(sim, STEP_MS);
    onStep(sim);
  }
  return sim;
}

describe('dumbbell bounce', () => {
  it('bounces exactly the rolled number of times, then falls out on its own', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const target = 1 + (seed % 12);
      const sim = playRound(seed, target, () => undefined);
      expect(sim.ended).toBe(true);
      expect(sim.falling).toBe(true);
      expect(sim.hits).toBe(target);
    }
  });

  it('rebounds slowly: about one hit per second at 1x', () => {
    const gaps: number[] = [];
    for (let seed = 1; seed <= 20; seed += 1) {
      let hits = 0;
      let last = 0;
      playRound(seed, 30, (sim) => {
        if (sim.hits > hits) {
          if (hits > 0) gaps.push(sim.time - last);
          hits = sim.hits;
          last = sim.time;
        }
      });
    }
    const sorted = [...gaps].sort((a, b) => a - b);
    expect(sorted[0]).toBeGreaterThan(0.3);
    expect(sorted[Math.floor(sorted.length / 2)]).toBeGreaterThan(0.75);
    expect(sorted[Math.floor(sorted.length / 2)]).toBeLessThan(1.25);
  });

  it('alternates plates and spins the plate it hits', () => {
    let hits = 0;
    const sides: string[] = [];
    const sim = playRound(5, 8, (current) => {
      if (current.hits > hits) {
        hits = current.hits;
        sides.push(current.lastHitAt.left > current.lastHitAt.right ? 'left' : 'right');
      }
    });
    sides.slice(1).forEach((side, index) => expect(side).not.toBe(sides[index]));
    expect(Math.abs(sim.plateAngle.left) + Math.abs(sim.plateAngle.right)).toBeGreaterThan(0);
  });

  it('never flies through a plate', () => {
    for (let seed = 1; seed <= 6; seed += 1) {
      playRound(seed, 12, (sim) => {
        PLATES.forEach((plate) => {
          expect(Math.hypot(sim.body.x - plate.x, sim.body.y - plate.y)).toBeGreaterThan(plate.radius);
        });
      });
    }
  });

  it('rolls a long tail: mostly tens, some hundreds, rarely thousands', () => {
    const random = seededRandom(1);
    const hits = Array.from({ length: 20000 }, () => rollTargetHits(random));
    const share = (min: number, max: number) => hits.filter((h) => h >= min && h < max).length / hits.length;
    expect(Math.min(...hits)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...hits)).toBeLessThanOrEqual(MAX_HITS);
    expect(share(10, 100)).toBeGreaterThan(0.45);
    expect(share(100, 1000)).toBeGreaterThan(0.12);
    expect(share(1000, Infinity)).toBeGreaterThan(0.003);
  });

  it('speed only fast-forwards time and does not change the round', () => {
    const start = createRound(seededRandom(7), 40);
    const normal = advanceSim(start, 8000, 1);
    const tenTimes = advanceSim(start, 800, 10);
    expect(tenTimes.hits).toBe(normal.hits);
    expect(tenTimes.body.x).toBeCloseTo(normal.body.x, 9);
    expect(tenTimes.body.y).toBeCloseTo(normal.body.y, 9);
  });

  it('is deterministic for the same seed and stops changing once ended', () => {
    const first = createRound(seededRandom(42), 6);
    const second = createRound(seededRandom(42), 6);
    expect(runToEnd(first)).toEqual(runToEnd(second));

    let sim = first;
    while (!sim.ended) sim = advanceSim(sim, 1000);
    expect(advanceSim(sim, 5000)).toBe(sim);
  });

  it('only reports reps once the dumbbell has been released', () => {
    expect(repsFromScene({ hits: 0, status: 'idle' })).toBeNull();
    expect(repsFromScene({ hits: 0, status: 'countdown' })).toBeNull();
    expect(repsFromScene({ hits: 3, status: 'bouncing' })).toBe(3);
    expect(repsFromScene({ hits: 3, status: 'result' })).toBe(3);
  });
});
