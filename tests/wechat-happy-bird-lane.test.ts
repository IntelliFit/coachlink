import { describe, expect, it } from 'vitest';
import {
  addLaneSample,
  LANE_SAMPLE_LIMIT,
  laneFromSamples,
  MAX_LANE_HALF_SPAN,
  MIN_LANE_HALF_SPAN
} from '../apps/wechat/src/toolbox/happy-bird/birdLane';
import {
  advanceGame,
  BIRD_X,
  COUNTDOWN_MS,
  createGame,
  gateCenterNow,
  GATES_PER_LEVEL,
  startCountdown,
  WARMUP_GATES,
  type BirdGame,
  type GateObstacle,
  type Lane
} from '../apps/wechat/src/toolbox/happy-bird/birdModel';

const FRAME_MS = 33;

function samplesBetween(low: number, high: number, count = 200) {
  return Array.from({ length: count }, (_, index) => low + ((high - low) * (Math.sin(index / 6) + 1)) / 2);
}

describe('happy bird lane calibration', () => {
  it('centres the lane on where the eyes actually travel', () => {
    const lane = laneFromSamples(samplesBetween(0.3, 0.5), 0.4);
    expect(lane.center).toBeCloseTo(0.4, 1);
    expect(lane.halfSpan).toBeGreaterThan(0.07);
    expect(lane.halfSpan).toBeLessThan(0.1);
  });

  it('ignores a few tracking glitches instead of stretching the lane to them', () => {
    const samples = [...samplesBetween(0.4, 0.6), 0.02, 0.98, 0.03];
    const lane = laneFromSamples(samples, 0.5);
    expect(lane.center - lane.halfSpan).toBeGreaterThan(0.35);
    expect(lane.center + lane.halfSpan).toBeLessThan(0.65);
  });

  it('keeps a minimum lane when the head barely moves, and starts at the current eye height', () => {
    expect(laneFromSamples([], 0.45)).toEqual({ center: 0.45, halfSpan: MIN_LANE_HALF_SPAN });
    expect(laneFromSamples(samplesBetween(0.5, 0.51), 0.5).halfSpan).toBe(MIN_LANE_HALF_SPAN);
  });

  it('never grows past the full-screen lane and stays on screen', () => {
    const wide = laneFromSamples(samplesBetween(0, 1), 0.5);
    expect(wide.halfSpan).toBe(MAX_LANE_HALF_SPAN);
    const low = laneFromSamples(samplesBetween(0.85, 0.95), 0.9);
    expect(low.center + low.halfSpan).toBeLessThanOrEqual(0.9 + 1e-9);
  });

  it('keeps a bounded window of samples without mutating the input', () => {
    let samples: number[] = [];
    for (let index = 0; index < LANE_SAMPLE_LIMIT + 50; index += 1) samples = addLaneSample(samples, index / 1000);
    expect(samples).toHaveLength(LANE_SAMPLE_LIMIT);
    const before = samples.slice();
    addLaneSample(samples, 0.5);
    expect(samples).toEqual(before);
  });
});

/** 真人：眼睛只能在 [low, high] 之间动，速度有上限，盯着下一道门的中心。 */
function boundedPilot(low: number, high: number, maxSpeedPerSecond = 1.2) {
  let y = (low + high) / 2;
  return (game: BirdGame) => {
    const threat = game.obstacles
      .filter((item) => item.x + (item.kind === 'gate' ? item.width / 2 : item.halfLength) > BIRD_X - 0.08)
      .sort((a, b) => a.x - b.x)[0];
    const wanted = !threat ? (low + high) / 2 : threat.kind === 'gate' ? gateCenterNow(threat) : game.routeY ?? y;
    const target = Math.min(high, Math.max(low, wanted));
    const step = maxSpeedPerSecond * (FRAME_MS / 1000);
    y += Math.max(-step, Math.min(step, target - y));
    return y;
  };
}

/** 和页面一样：热身门出完之前按样本更新通道，之后固定。 */
function playWithLane(seed: number, low: number, high: number, durationMs: number) {
  let game = startCountdown(createGame({ aspect: 1.9, seed }), seed);
  let samples: number[] = [];
  let frozen: Lane | null = null;
  const pilot = boundedPilot(low, high);
  const gates: GateObstacle[] = [];
  const seen = new Set<number>();
  for (let at = 0; at < COUNTDOWN_MS + durationMs; at += FRAME_MS) {
    const eyeY = pilot(game);
    if (game.status === 'playing' && !frozen) {
      samples = addLaneSample(samples, eyeY);
      if (game.gatesSpawned >= WARMUP_GATES) frozen = laneFromSamples(samples, eyeY);
    }
    const lane = frozen ?? laneFromSamples(samples, eyeY);
    game = advanceGame(game, FRAME_MS, { lane, targetY: eyeY, tracking: true }).game;
    game.obstacles.forEach((item) => {
      if (item.kind === 'gate' && !seen.has(item.id)) {
        seen.add(item.id);
        gates.push(item);
      }
    });
    if (game.status !== 'playing' && game.status !== 'countdown') break;
  }
  return { frozen, game, gates };
}

describe('happy bird with the bird locked to the eyes', () => {
  it('the bird sits exactly on the eye line, with no amplification', () => {
    let game = createGame({ seed: 1 });
    for (let index = 0; index < 30; index += 1) game = advanceGame(game, FRAME_MS, { targetY: 0.42, tracking: true }).game;
    expect(game.bird.y).toBeCloseTo(0.42, 3);
  });

  it.each([3, 11, 29])('a player whose eyes move only 20% of the screen can still clear the late levels (seed %i)', (seed) => {
    const { frozen, game } = playWithLane(seed, 0.4, 0.6, 90_000);
    expect(frozen).not.toBeNull();
    expect(game.gatesPassed).toBeGreaterThan(GATES_PER_LEVEL * 3);
    expect(game.lives).toBeGreaterThan(0);
  });

  it('puts every gap inside the range the eyes actually travel', () => {
    const { gates } = playWithLane(11, 0.45, 0.65, 60_000);
    gates.slice(WARMUP_GATES + 1).forEach((gate) => {
      expect(gate.center).toBeGreaterThan(0.45 - 0.02);
      expect(gate.center).toBeLessThan(0.65 + 0.02);
    });
  });

  it('skips the spinning barbell for a lane too narrow to dodge it', () => {
    const { game } = playWithLane(29, 0.45, 0.55, 90_000);
    expect(game.lane.halfSpan).toBeLessThan(0.22);
    expect(game.obstacles.some((item) => item.kind === 'spinner')).toBe(false);
  });

  it('counts reps relative to the player lane, so small movers still get credit', () => {
    let game: BirdGame = { ...startCountdown(createGame({ seed: 2 }), 2), status: 'playing', distanceToNext: 99 };
    const lane = { center: 0.5, halfSpan: 0.1 };
    const moveTo = (target: number) => {
      for (let index = 0; index < 30; index += 1) {
        game = { ...advanceGame(game, FRAME_MS, { lane, targetY: target, tracking: true }).game, distanceToNext: 99, obstacles: [], pickups: [] };
      }
    };
    moveTo(0.58);
    moveTo(0.42);
    moveTo(0.58);
    expect(game.reps).toBe(1);
  });
});
