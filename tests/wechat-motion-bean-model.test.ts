import { describe, expect, it } from 'vitest';
import {
  advanceBeanGame,
  BAD_PENALTY,
  BEAN_COUNTDOWN_MS,
  BEAN_ROUND_MS,
  beanTitle,
  beanTouchesFace,
  cancelBeanToIdle,
  comboMultiplier,
  createBeanGame,
  difficultyAt,
  endBeanRun,
  GOLD_SCORE,
  startBeanCountdown,
  type Bean,
  type BeanEvent,
  type BeanFace,
  type BeanGame
} from '../apps/wechat/src/toolbox/motion-bean/beanModel';

const FRAME_MS = 33;
const CENTER: BeanFace = { radiusX: 0.12, x: 0.5, y: 0.5 };

function beanAt(x: number, y: number, kind: Bean['kind'] = 'good'): Bean {
  return { id: 9000 + Math.round(x * 100), kind, rotation: 0, spin: 0, vx: 0, vy: 0, x, y };
}

function run(game: BeanGame, durationMs: number, pilot: (game: BeanGame) => BeanFace | null) {
  let current = game;
  const events: BeanEvent[] = [];
  for (let at = 0; at < durationMs; at += FRAME_MS) {
    const face = pilot(current);
    const step = advanceBeanGame(current, FRAME_MS, { face, tracking: Boolean(face) });
    current = step.game;
    events.push(...step.events);
    if (current.status === 'result') break;
  }
  return { events, game: current };
}

function playing(seed = 7) {
  return run(startBeanCountdown(createBeanGame({ aspect: 1.9, seed }), seed), BEAN_COUNTDOWN_MS + 100, () => CENTER).game;
}

/** 模拟真人：盯着最近的好豆走，移动速度有上限，不主动躲坏豆。 */
function chaser(speedPerSecond: number): (game: BeanGame) => BeanFace {
  let x = 0.5;
  let y = 0.45;
  return (game) => {
    const target = game.beans
      .filter((bean) => bean.kind !== 'bad' && bean.y > 0.1 && bean.y < 0.8)
      .sort((a, b) => b.y - a.y)[0];
    const step = speedPerSecond * (FRAME_MS / 1000);
    if (target) {
      x += Math.max(-step, Math.min(step, target.x - x));
      y += Math.max(-step, Math.min(step, Math.min(0.7, target.y + 0.08) - y));
    }
    return { radiusX: 0.11, x, y };
  };
}

describe('bean game flow', () => {
  it('counts down 5..1, starts empty, then rains beans', () => {
    const { events, game } = run(startBeanCountdown(createBeanGame({ seed: 3 }), 3), BEAN_COUNTDOWN_MS - 100, () => CENTER);
    expect(events.filter((item) => item.type === 'countdownTick').map((item) => item.value)).toEqual([5, 4, 3, 2, 1]);
    expect(game.beans).toHaveLength(0);
    const started = run(game, 3000, () => CENTER);
    expect(started.events.filter((item) => item.type === 'go')).toHaveLength(1);
    expect(started.game.status).toBe('playing');
    expect(started.game.beans.length).toBeGreaterThan(0);
  });

  it('ends after the round time and announces the final sprint once', () => {
    const { events, game } = run(playing(), BEAN_ROUND_MS + 2000, () => CENTER);
    expect(game.status).toBe('result');
    expect(game.elapsedMs).toBe(BEAN_ROUND_MS);
    expect(events.filter((item) => item.type === 'sprint')).toHaveLength(1);
    expect(events.filter((item) => item.type === 'gameOver')).toHaveLength(1);
    expect(game.beans).toHaveLength(0);
  });

  it('freezes time and beans while the face is lost, then resumes', () => {
    const before = run(playing(), 4000, () => CENTER).game;
    const paused = advanceBeanGame(before, FRAME_MS, { face: null, tracking: false }).game;
    expect(paused.paused).toBe(true);
    expect(paused.elapsedMs).toBe(before.elapsedMs);
    expect(paused.beans.map((bean) => bean.y)).toEqual(before.beans.map((bean) => bean.y));
    const resumed = advanceBeanGame(paused, FRAME_MS, { face: CENTER, tracking: true }).game;
    expect(resumed.paused).toBe(false);
    expect(resumed.elapsedMs).toBeGreaterThan(before.elapsedMs);
  });

  it('cancel and early end behave', () => {
    const counting = run(startBeanCountdown(createBeanGame({ seed: 3 }), 3), 1000, () => CENTER).game;
    expect(cancelBeanToIdle(counting).status).toBe('idle');
    const ended = endBeanRun({ ...playing(), score: 42 });
    expect(ended.status).toBe('result');
    expect(ended.score).toBe(42);
    const idle = createBeanGame();
    expect(endBeanRun(idle)).toBe(idle);
  });

  it('clamps huge frame gaps', () => {
    const before = playing();
    const after = advanceBeanGame(before, 5000, { face: CENTER, tracking: true }).game;
    expect(after.elapsedMs - before.elapsedMs).toBeLessThanOrEqual(64);
  });
});

describe('bean scoring', () => {
  const withBean = (bean: Bean, overrides: Partial<BeanGame> = {}): BeanGame => ({
    ...playing(),
    beans: [bean],
    face: CENTER,
    spawnInMs: 9999,
    ...overrides
  });
  const stepWith = (game: BeanGame) => advanceBeanGame(game, FRAME_MS, { face: CENTER, tracking: true });

  it('a bean touching the face is eaten; one far away is not', () => {
    const near = stepWith(withBean(beanAt(0.5, 0.5)));
    expect(near.game.score).toBe(1);
    expect(near.game.beans).toHaveLength(0);
    expect(near.events.some((item) => item.type === 'catch')).toBe(true);
    const far = stepWith(withBean(beanAt(0.9, 0.1)));
    expect(far.game.score).toBe(0);
    expect(far.game.beans).toHaveLength(1);
  });

  it('gold beans are worth more', () => {
    const step = stepWith(withBean(beanAt(0.5, 0.5, 'gold')));
    expect(step.game.score).toBe(GOLD_SCORE);
    expect(step.game.golds).toBe(1);
  });

  it('a bad bean costs points and the combo, but score never goes negative', () => {
    const step = stepWith(withBean(beanAt(0.5, 0.5, 'bad'), { combo: 8, score: 10 }));
    expect(step.game.score).toBe(10 - BAD_PENALTY);
    expect(step.game.combo).toBe(0);
    expect(step.game.flashMs).toBeGreaterThan(0);
    expect(stepWith(withBean(beanAt(0.5, 0.5, 'bad'), { score: 1 })).game.score).toBe(0);
  });

  it('combos multiply the score and announce the step up', () => {
    expect([1, 4, 5, 14, 15].map(comboMultiplier)).toEqual([1, 1, 2, 2, 3]);
    const step = stepWith(withBean(beanAt(0.5, 0.5), { combo: 4, score: 0 }));
    expect(step.game.score).toBe(2);
    expect(step.events.some((item) => item.type === 'comboUp' && item.value === 2)).toBe(true);
  });

  it('missing a good bean does not break the combo', () => {
    const game = withBean(beanAt(0.1, 1.07), { combo: 6 });
    const step = advanceBeanGame({ ...game, beans: [{ ...game.beans[0], vy: 0.5 }] }, 64, { face: CENTER, tracking: true });
    expect(step.game.beans).toHaveLength(0);
    expect(step.game.combo).toBe(6);
  });

  it('grazing a bad bean does not count, the same graze on a good bean does', () => {
    const graze = 0.14;
    expect(beanTouchesFace(beanAt(0.5 + graze, 0.5, 'bad'), CENTER, 1.9)).toBe(false);
    expect(beanTouchesFace(beanAt(0.5 + graze, 0.5, 'good'), CENTER, 1.9)).toBe(true);
  });

  it('a very small or very large detected face stays playable', () => {
    expect(beanTouchesFace(beanAt(0.57, 0.5), { ...CENTER, radiusX: 0.01 }, 1.9)).toBe(true);
    expect(beanTouchesFace(beanAt(0.9, 0.5), { ...CENTER, radiusX: 0.9 }, 1.9)).toBe(false);
  });
});

describe('bean difficulty and fairness', () => {
  it('gets harder over time and steps up in the final sprint', () => {
    const early = difficultyAt(0);
    const late = difficultyAt(34000);
    const sprint = difficultyAt(40000);
    expect(late.fallSpeed).toBeGreaterThan(early.fallSpeed);
    expect(late.spawnEveryMs).toBeLessThan(early.spawnEveryMs);
    expect(sprint.spawnEveryMs).toBeLessThan(late.spawnEveryMs);
  });

  it.each([3, 11, 29, 47, 101])('a player who moves scores far more than one who stands still (seed %i)', (seed) => {
    const moving = run(playing(seed), BEAN_ROUND_MS, chaser(1.1)).game;
    const still = run(playing(seed), BEAN_ROUND_MS, () => ({ radiusX: 0.11, x: 0.5, y: 0.45 })).game;
    expect(moving.caught).toBeGreaterThan(still.caught * 2);
    expect(moving.score).toBeGreaterThan(still.score);
    expect(moving.score).toBeGreaterThan(40);
  });

  it('spawns inside the playable width and spreads beans out', () => {
    const seen = new Map<number, Bean>();
    let game = playing(9);
    for (let at = 0; at < 30000; at += FRAME_MS) {
      game = advanceBeanGame(game, FRAME_MS, { face: { radiusX: 0.11, x: 2, y: 2 }, tracking: true }).game;
      game.beans.forEach((bean) => { if (!seen.has(bean.id)) seen.set(bean.id, bean); });
    }
    const beans = [...seen.values()];
    expect(beans.length).toBeGreaterThan(30);
    beans.forEach((bean) => {
      expect(bean.x).toBeGreaterThanOrEqual(0.05);
      expect(bean.x).toBeLessThanOrEqual(0.95);
    });
    expect(beans.filter((bean) => bean.kind === 'bad').length).toBeGreaterThan(2);
    expect(beans.filter((bean) => bean.kind === 'good').length).toBeGreaterThan(beans.length / 2);
  });

  it('stays deterministic for the same seed', () => {
    const first = run(playing(21), 8000, () => CENTER).game;
    const second = run(playing(21), 8000, () => CENTER).game;
    expect(second.score).toBe(first.score);
    expect(second.beans.map((bean) => bean.x)).toEqual(first.beans.map((bean) => bean.x));
  });

  it('maps scores to rising titles', () => {
    expect(beanTitle(0)).toBe('豆子新手');
    expect(beanTitle(200)).toBe('接豆能手');
    expect(beanTitle(500)).toBe('豆神');
  });
});
