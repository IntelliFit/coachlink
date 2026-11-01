import { describe, expect, it } from 'vitest';
import {
  advanceGame,
  BIRD_X,
  birdHitsGate,
  birdHitsSpinner,
  birdTitle,
  cancelToIdle,
  COIN_SCORE,
  COUNTDOWN_MS,
  createGame,
  endRun,
  FEVER_MS,
  FIRST_FEVER_COMBO,
  GATE_SCORE,
  gateCenterNow,
  gateEdges,
  GATES_PER_LEVEL,
  levelConfig,
  MAX_LIVES,
  PERFECT_SCORE,
  startCountdown,
  WARMUP_GATES,
  type BirdEvent,
  type BirdGame,
  type GateObstacle,
  type Obstacle,
  type SpinnerObstacle
} from '../apps/wechat/src/toolbox/happy-bird/birdModel';

const FRAME_MS = 33;

type Pilot = (game: BirdGame) => number;

function nextThreat(game: BirdGame): Obstacle | null {
  return game.obstacles
    .filter((item) => item.x + (item.kind === 'gate' ? item.width / 2 : item.halfLength) > BIRD_X - 0.08)
    .sort((a, b) => a.x - b.x)[0] || null;
}

/** 模拟真人：目标是下一个门的中心，移动速度有上限（一次完整动作约 1.2 秒）。 */
function humanPilot(maxSpeedPerSecond = 1.2): Pilot {
  let y = 0.5;
  return (game) => {
    const threat = nextThreat(game);
    const target = !threat
      ? 0.5
      : threat.kind === 'gate'
        ? gateCenterNow(threat)
        : threat.y + (game.routeY !== null && game.routeY < 0.5 ? -0.3 : 0.3);
    const step = maxSpeedPerSecond * (FRAME_MS / 1000);
    y += Math.max(-step, Math.min(step, target - y));
    return y;
  };
}

function run(
  game: BirdGame,
  durationMs: number,
  pilot: Pilot,
  stop?: (game: BirdGame, events: BirdEvent[]) => boolean
) {
  let current = game;
  const events: BirdEvent[] = [];
  for (let at = 0; at < durationMs; at += FRAME_MS) {
    const step = advanceGame(current, FRAME_MS, { targetY: pilot(current), tracking: true });
    current = step.game;
    events.push(...step.events);
    if (stop?.(current, step.events)) break;
  }
  return { events, game: current };
}

function playingGame(seed = 7) {
  const started = startCountdown(createGame({ aspect: 1.9, seed }), seed);
  return run(started, COUNTDOWN_MS + 100, () => 0.5).game;
}

function gateAt(x: number, overrides: Partial<GateObstacle> = {}): GateObstacle {
  return {
    center: 0.5,
    gapHeight: 0.3,
    ghosted: false,
    id: 9000,
    kind: 'gate',
    passed: false,
    swing: null,
    warmup: false,
    width: 0.17,
    x,
    ...overrides
  };
}

describe('happy bird flow', () => {
  it('counts down 5..1 then starts playing with a GO event', () => {
    const { events, game } = run(startCountdown(createGame({ seed: 3 }), 3), COUNTDOWN_MS + 100, () => 0.5);
    const ticks = events.filter((item) => item.type === 'countdownTick').map((item) => item.value);
    expect(ticks).toEqual([5, 4, 3, 2, 1]);
    expect(events.filter((item) => item.type === 'go')).toHaveLength(1);
    expect(game.status).toBe('playing');
    expect(game.lives).toBe(MAX_LIVES);
    expect(game.score).toBe(0);
  });

  it('does not spawn anything during the countdown', () => {
    const { game } = run(startCountdown(createGame({ seed: 3 }), 3), COUNTDOWN_MS - 200, () => 0.5);
    expect(game.obstacles).toHaveLength(0);
    expect(game.pickups).toHaveLength(0);
  });

  it('freezes the world while the head is not tracked', () => {
    const playing = run(playingGame(), 2000, () => 0.5).game;
    const step = advanceGame(playing, FRAME_MS, { targetY: null, tracking: false });
    expect(step.game.paused).toBe(true);
    expect(step.game.elapsedMs).toBe(playing.elapsedMs);
    expect(step.game.obstacles.map((item) => item.x)).toEqual(playing.obstacles.map((item) => item.x));
    const resumed = advanceGame(step.game, FRAME_MS, { targetY: 0.5, tracking: true });
    expect(resumed.game.paused).toBe(false);
    expect(resumed.game.elapsedMs).toBeGreaterThan(playing.elapsedMs);
  });

  it('cancel returns to idle with a clean slate', () => {
    const game = cancelToIdle(run(startCountdown(createGame({ seed: 3 }), 3), 1000, () => 0.5).game);
    expect(game.status).toBe('idle');
    expect(game.statusMs).toBe(0);
  });

  it('clamps huge frame gaps so a stall cannot teleport obstacles', () => {
    const playing = run(playingGame(), 3000, () => 0.5).game;
    const step = advanceGame(playing, 5000, { targetY: 0.5, tracking: true });
    expect(step.game.elapsedMs - playing.elapsedMs).toBeLessThanOrEqual(64);
  });
});

describe('happy bird collisions', () => {
  it('only collides when the gate overlaps the bird lane', () => {
    expect(birdHitsGate(0.1, gateAt(0.8), 1.9)).toBe(false);
    expect(birdHitsGate(0.1, gateAt(BIRD_X), 1.9)).toBe(true);
    expect(birdHitsGate(0.5, gateAt(BIRD_X), 1.9)).toBe(false);
    expect(birdHitsGate(0.9, gateAt(BIRD_X), 1.9)).toBe(true);
  });

  it('follows a swinging gate', () => {
    const gate = gateAt(BIRD_X, { swing: { amplitude: 0.08, periodMs: 1000, phaseMs: 250 } });
    expect(gateCenterNow(gate)).toBeCloseTo(0.58);
    expect(gateEdges(gate).top).toBeCloseTo(0.43);
    expect(birdHitsGate(0.4, gate, 1.9)).toBe(true);
  });

  it('hits a spinner along its whole length, not just the center', () => {
    const spinner: SpinnerObstacle = {
      angle: Math.PI / 2,
      ghosted: false,
      halfLength: 0.26,
      id: 1,
      kind: 'spinner',
      omega: 0,
      passed: false,
      warmup: false,
      x: BIRD_X,
      y: 0.5
    };
    expect(birdHitsSpinner(0.5, spinner, 1.9)).toBe(true);
    expect(birdHitsSpinner(0.5 + 0.2 / 1.9, spinner, 1.9)).toBe(true);
    expect(birdHitsSpinner(0.5 + 0.34 / 1.9, spinner, 1.9)).toBe(false);
    expect(birdHitsSpinner(0.5, { ...spinner, x: BIRD_X + 0.2 }, 1.9)).toBe(false);
  });
});

describe('happy bird scoring', () => {
  it('scores a pass through the gap edge and a higher perfect through the center', () => {
    const base = playingGame();
    const near = { ...base, obstacles: [gateAt(BIRD_X - 0.13)] };
    const center = advanceGame(near, FRAME_MS, { targetY: 0.5, tracking: true });
    expect(center.events.some((item) => item.type === 'perfect')).toBe(true);
    expect(center.game.score).toBe(PERFECT_SCORE);

    const offCenter = {
      ...base,
      bird: { ...base.bird, y: 0.6 },
      obstacles: [gateAt(BIRD_X - 0.13)]
    };
    const edge = advanceGame(offCenter, FRAME_MS, { targetY: 0.6, tracking: true });
    expect(edge.events.some((item) => item.type === 'pass')).toBe(true);
    expect(edge.game.score).toBe(GATE_SCORE);
    expect(edge.game.combo).toBe(1);
  });

  it('collects coins on the route', () => {
    const base = playingGame();
    const withCoin: BirdGame = {
      ...base,
      obstacles: [],
      pickups: [{ id: 8000, kind: 'coin', x: BIRD_X, y: 0.5 }]
    };
    const step = advanceGame(withCoin, FRAME_MS, { targetY: 0.5, tracking: true });
    expect(step.events.some((item) => item.type === 'coin')).toBe(true);
    expect(step.game.score).toBe(COIN_SCORE);
    expect(step.game.pickups).toHaveLength(0);
  });

  it('levels up every few gates and fires a banner', () => {
    const base = {
      ...playingGame(),
      gatesPassed: GATES_PER_LEVEL - 1,
      nextFeverCombo: 99,
      obstacles: [gateAt(BIRD_X - 0.13)]
    };
    const step = advanceGame(base, FRAME_MS, { targetY: 0.5, tracking: true });
    expect(step.game.level).toBe(2);
    expect(step.game.banner?.text).toBe('第 2 关');
    expect(step.events.some((item) => item.type === 'level')).toBe(true);
  });

  it('counts a full up-down cycle as one rep regardless of exercise', () => {
    let game = { ...playingGame(), obstacles: [], distanceToNext: 99 };
    const events: BirdEvent[] = [];
    const moveTo = (target: number) => {
      for (let i = 0; i < 40; i += 1) {
        const step = advanceGame(game, FRAME_MS, { targetY: target, tracking: true });
        game = { ...step.game, obstacles: [], distanceToNext: 99, pickups: [] };
        events.push(...step.events);
      }
    };
    moveTo(0.8);
    moveTo(0.2);
    expect(game.reps).toBe(0);
    moveTo(0.8);
    expect(game.reps).toBe(1);
    moveTo(0.2);
    moveTo(0.8);
    expect(game.reps).toBe(2);
    expect(events.filter((item) => item.type === 'rep')).toHaveLength(2);
  });
});

describe('happy bird damage, fever and shield', () => {
  const blocker = () => gateAt(BIRD_X, { center: 0.2, gapHeight: 0.1 });

  it('loses a life, resets the combo, shatters the gate and grants invincibility', () => {
    const base = { ...playingGame(), combo: 5, obstacles: [blocker()] };
    const step = advanceGame(base, FRAME_MS, { targetY: 0.5, tracking: true });
    expect(step.game.lives).toBe(MAX_LIVES - 1);
    expect(step.game.combo).toBe(0);
    expect(step.game.invincibleMs).toBeGreaterThan(0);
    expect(step.game.obstacles).toHaveLength(0);
    expect(step.game.fx.some((item) => item.kind === 'plate')).toBe(true);
  });

  it('warm-up gates cost the combo but no life, so a first-timer cannot die in seconds', () => {
    const base = {
      ...playingGame(),
      combo: 3,
      obstacles: [gateAt(BIRD_X, { center: 0.2, gapHeight: 0.1, warmup: true })],
      shield: true
    };
    const step = advanceGame(base, FRAME_MS, { targetY: 0.5, tracking: true });
    expect(step.events.some((item) => item.type === 'bump')).toBe(true);
    expect(step.game.lives).toBe(MAX_LIVES);
    expect(step.game.combo).toBe(0);
    expect(step.game.shield).toBe(true);
    expect(step.game.obstacles).toHaveLength(0);
  });

  it('marks exactly the first gates as warm-up, then starts charging lives', () => {
    const { game, events } = run(playingGame(5), 40_000, () => 0.9, (current) => current.lives < MAX_LIVES);
    expect(events.filter((item) => item.type === 'bump').length).toBeGreaterThanOrEqual(3);
    expect(events.filter((item) => item.type === 'bump').length).toBeLessThanOrEqual(WARMUP_GATES);
    expect(game.lives).toBe(MAX_LIVES - 1);
    expect(game.gatesSpawned).toBeGreaterThan(WARMUP_GATES);
  });

  it('does not lose a second life while invincible and does not award the ghosted gate', () => {
    const base = { ...playingGame(), invincibleMs: 1000, obstacles: [blocker()] };
    const inside = advanceGame(base, FRAME_MS, { targetY: 0.5, tracking: true });
    expect(inside.game.lives).toBe(MAX_LIVES);
    const outside = run({ ...inside.game, distanceToNext: 99 }, 1600, () => 0.5).game;
    expect(outside.lives).toBe(MAX_LIVES);
    expect(outside.gatesPassed).toBe(0);
  });

  it('a shield absorbs one hit without touching lives or combo', () => {
    const base = { ...playingGame(), combo: 4, obstacles: [blocker()], shield: true };
    const step = advanceGame(base, FRAME_MS, { targetY: 0.5, tracking: true });
    expect(step.game.shield).toBe(false);
    expect(step.game.lives).toBe(MAX_LIVES);
    expect(step.game.combo).toBe(4);
    expect(step.events.some((item) => item.type === 'shieldBreak')).toBe(true);
  });

  it('enters fever at the combo threshold; fever doubles score and smashes gates', () => {
    const base = {
      ...playingGame(),
      combo: FIRST_FEVER_COMBO - 1,
      obstacles: [gateAt(BIRD_X - 0.13)]
    };
    const fever = advanceGame(base, FRAME_MS, { targetY: 0.5, tracking: true });
    expect(fever.events.some((item) => item.type === 'fever')).toBe(true);
    expect(fever.game.feverMs).toBe(FEVER_MS);
    expect(fever.game.banner?.tone).toBe('fever');

    const smashing = { ...fever.game, obstacles: [blocker()], score: 0 };
    const step = advanceGame(smashing, FRAME_MS, { targetY: 0.5, tracking: true });
    expect(step.game.lives).toBe(MAX_LIVES);
    expect(step.events.some((item) => item.type === 'smash')).toBe(true);
    expect(step.game.score).toBe(GATE_SCORE * 2);
    expect(step.game.obstacles).toHaveLength(0);
  });

  it('crashes on the last life, then lands on the result screen', () => {
    const base = { ...playingGame(), lives: 1, obstacles: [blocker()] };
    const crash = advanceGame(base, FRAME_MS, { targetY: 0.5, tracking: true });
    expect(crash.game.status).toBe('crashing');
    expect(crash.events.some((item) => item.type === 'gameOver')).toBe(true);
    const frozenElapsed = crash.game.elapsedMs;
    const end = run(crash.game, 2500, () => 0.5).game;
    expect(end.status).toBe('result');
    expect(end.elapsedMs).toBe(frozenElapsed);
    expect(end.bird.y).toBeGreaterThan(0.9);
  });
});

describe('happy bird fairness', () => {
  it('gates alternate high and low so a full rep clears two gates', () => {
    const gates: GateObstacle[] = [];
    let game = playingGame(11);
    const seen = new Set<number>();
    const pilot = humanPilot();
    for (let at = 0; at < 18_000; at += FRAME_MS) {
      const step = advanceGame(game, FRAME_MS, { targetY: pilot(game), tracking: true });
      game = step.game;
      game.obstacles.forEach((item) => {
        if (item.kind === 'gate' && !seen.has(item.id)) {
          seen.add(item.id);
          gates.push(item);
        }
      });
    }
    // 第一道门是居中的热身门，从第二道起在第 1 关严格一上一下。
    const sides = gates.slice(1, 6).map((gate) => Math.sign(gate.center - 0.5));
    expect(sides.length).toBeGreaterThanOrEqual(4);
    sides.slice(1).forEach((side, index) => expect(side).toBe(-sides[index]));
  });

  it('every generated gap stays inside the range the bird can reach', () => {
    [1, 2, 3, 4, 5, 6].forEach((level) => {
      const config = levelConfig(level);
      const swing = 0.08;
      const highestCenter = 0.5 - config.amplitude - swing;
      const lowestCenter = 0.5 + config.amplitude + swing;
      // 校准后一次完整动作覆盖 12%–88%。
      expect(highestCenter + config.gapHeight / 2).toBeGreaterThan(0.12);
      expect(lowestCenter - config.gapHeight / 2).toBeLessThan(0.88);
    });
  });

  it.each([3, 11, 29, 47, 101])('a human-speed player can survive into the late levels (seed %i)', (seed) => {
    const { game } = run(playingGame(seed), 90_000, humanPilot(1.5), (current) => current.status !== 'playing');
    expect(game.level).toBeGreaterThanOrEqual(4);
    expect(game.gatesPassed).toBeGreaterThan(GATES_PER_LEVEL * 3);
    expect(game.score).toBeGreaterThan(0);
  });

  it('a player who does not move at all loses quickly', () => {
    const { game } = run(playingGame(5), 60_000, () => 0.5, (current) => current.status !== 'playing');
    expect(game.status).toBe('crashing');
  });

  it('stays deterministic for the same seed', () => {
    const first = run(playingGame(21), 8000, () => 0.5).game;
    const second = run(playingGame(21), 8000, () => 0.5).game;
    expect(second.score).toBe(first.score);
    expect(second.obstacles.map((item) => item.x)).toEqual(first.obstacles.map((item) => item.x));
  });

  it('keeps the score under the server plausibility cap in a very long clean run', () => {
    const { game } = run(playingGame(13), 120_000, humanPilot(2), (current) => current.status !== 'playing');
    expect(game.score).toBeLessThanOrEqual(Math.floor(game.elapsedMs / 1000) * 120 + 200);
  });
});

describe('happy bird titles', () => {
  it('maps scores to rising titles', () => {
    expect(birdTitle(0)).toBe('刚出壳');
    expect(birdTitle(250)).toBe('能飞了');
    expect(birdTitle(5000)).toBe('鸟中之王');
  });
});

describe('happy bird manual end', () => {
  it('ending early goes through the same fall and keeps the score', () => {
    const base = { ...playingGame(), score: 120, gatesPassed: 4 };
    const crashing = endRun(base);
    expect(crashing.status).toBe('crashing');
    const end = run(crashing, 2500, () => 0.5).game;
    expect(end.status).toBe('result');
    expect(end.score).toBe(120);
    expect(end.lives).toBe(MAX_LIVES);
  });

  it('ignores the end button outside of play', () => {
    const idle = createGame({ seed: 1 });
    expect(endRun(idle)).toBe(idle);
  });
});

describe('happy bird stays quiet on screen', () => {
  it('leaves no particles behind ordinary play: coins and normal passes add nothing', () => {
    const base = {
      ...playingGame(),
      bird: { ...playingGame().bird, y: 0.6 },
      obstacles: [gateAt(BIRD_X - 0.13)],
      pickups: [{ id: 8000, kind: 'coin' as const, x: BIRD_X, y: 0.6 }]
    };
    const step = advanceGame(base, FRAME_MS, { targetY: 0.6, tracking: true });
    expect(step.events.some((item) => item.type === 'coin')).toBe(true);
    expect(step.events.some((item) => item.type === 'pass')).toBe(true);
    expect(step.game.fx).toHaveLength(0);
  });
});
