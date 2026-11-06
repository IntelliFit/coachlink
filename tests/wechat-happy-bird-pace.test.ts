import { describe, expect, it } from 'vitest';
import {
  advanceGame,
  BIRD_X,
  cancelToIdle,
  COUNTDOWN_MS,
  createGame,
  gateCenterNow,
  isBirdPace,
  LEVELS,
  PACE_ORDER,
  PACES,
  startCountdown,
  type BirdGame,
  type BirdPace
} from '../apps/wechat/src/toolbox/happy-bird/birdModel';

const FRAME_MS = 33;

/** 一个很强的玩家：眼睛快速对准下一道门的正中（或飞天杠铃的躲避路线）。 */
function sharpPilot(game: BirdGame) {
  const threat = game.obstacles
    .filter((item) => item.x + (item.kind === 'gate' ? item.width / 2 : item.halfLength) > BIRD_X - 0.08)
    .sort((a, b) => a.x - b.x)[0];
  if (!threat) return 0.5;
  return threat.kind === 'gate' ? gateCenterNow(threat) : game.routeY ?? 0.5;
}

function play(pace: BirdPace, durationMs: number, onFrame?: (game: BirdGame) => void) {
  let game = startCountdown(createGame({ aspect: 1.9, seed: 7 }), 7, pace);
  for (let at = 0; at < COUNTDOWN_MS + durationMs; at += FRAME_MS) {
    game = advanceGame(game, FRAME_MS, { targetY: sharpPilot(game), tracking: true }).game;
    onFrame?.(game);
    if (game.status !== 'playing' && game.status !== 'countdown') break;
  }
  return game;
}

/** 和服务端 isPlausibleMotionGameScore('happy-bird') 一致。 */
function serverAccepts(score: number, elapsedMs: number) {
  return score <= Math.floor(elapsedMs / 1000) * 120 + 200;
}

describe('happy bird speed tiers', () => {
  it('scales the scroll speed from the first frame and at every level', () => {
    PACE_ORDER.forEach((pace) => {
      const game = createGame({ pace });
      expect(game.pace).toBe(pace);
      expect(game.speed).toBeCloseTo(LEVELS[0].speed * PACES[pace].speed, 6);
    });
    const late = play('fast', 40_000);
    const levelSpeed = LEVELS[Math.min(late.level, LEVELS.length) - 1].speed;
    expect(late.speed).toBeGreaterThan(levelSpeed * 1.1);
  });

  it('brings the gates in faster on the fast tier and slower on the slow tier', () => {
    const passedAfter = (pace: BirdPace) => play(pace, 30_000).gatesPassed;
    expect(passedAfter('fast')).toBeGreaterThan(passedAfter('normal'));
    expect(passedAfter('slow')).toBeLessThan(passedAfter('normal'));
  });

  it('pays more per gate on faster tiers', () => {
    const firstGateScore = (pace: BirdPace) => {
      let score = 0;
      play(pace, 20_000, (game) => {
        if (!score && game.gatesPassed > 0) score = game.score;
      });
      return score;
    };
    expect(firstGateScore('fast')).toBeGreaterThan(firstGateScore('normal'));
    expect(firstGateScore('slow')).toBeLessThan(firstGateScore('normal'));
  });

  it('keeps the chosen tier across a new round and a cancelled countdown', () => {
    const fast = startCountdown(createGame(), 3, 'fast');
    expect(startCountdown(fast, 4).pace).toBe('fast');
    expect(cancelToIdle(fast).pace).toBe('fast');
  });

  it('a near-perfect run on the fast tier never trips the server score limit', () => {
    let peakRate = 0;
    const end = play('fast', 180_000, (game) => {
      if (game.status !== 'playing') return;
      expect(serverAccepts(game.score, game.elapsedMs)).toBe(true);
      if (game.elapsedMs > 10_000) peakRate = Math.max(peakRate, game.score / (game.elapsedMs / 1000));
    });
    // 这个玩家要真的玩得久、分得多，上面的检查才有意义。
    expect(end.elapsedMs).toBeGreaterThan(90_000);
    expect(peakRate).toBeGreaterThan(20);
    expect(peakRate).toBeLessThan(100);
  });

  it('only accepts the three known tiers from saved preferences', () => {
    expect(isBirdPace('fast')).toBe(true);
    expect(isBirdPace('turbo')).toBe(false);
    expect(isBirdPace(undefined)).toBe(false);
  });
});
