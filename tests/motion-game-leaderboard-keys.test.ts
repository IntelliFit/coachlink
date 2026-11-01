import { describe, expect, it } from 'vitest';
import {
  isMotionGameKey,
  isPlausibleMotionGameScore,
  MOTION_GAME_CONFIG,
} from '../src/lib/motionGameLeaderboard';
import { readFileSync } from 'node:fs';

describe('motion game leaderboard keys', () => {
  it('accepts the merged game and keeps the old keys readable', () => {
    expect(isMotionGameKey('happy-bird')).toBe(true);
    expect(isMotionGameKey('pullup-rush')).toBe(true);
    expect(isMotionGameKey('flappy')).toBe(false);
  });

  it('keeps mini-program template ids in sync with the server', () => {
    // 小程序服务依赖 Taro，单测里不能直接引入，这里读源码比对。
    const service = readFileSync('apps/wechat/src/services/motionGameLeaderboardService.ts', 'utf8');
    Object.entries(MOTION_GAME_CONFIG).forEach(([key, config]) => {
      expect(service).toContain(`'${key}': '${config.templateId}'`);
    });
  });

  it('applies a looser score cap to happy bird than to the old gate-count games', () => {
    expect(isPlausibleMotionGameScore(4000, 60_000, 'happy-bird')).toBe(true);
    expect(isPlausibleMotionGameScore(100_000, 60_000, 'happy-bird')).toBe(false);
    expect(isPlausibleMotionGameScore(4000, 60_000, 'pullup-rush')).toBe(false);
    expect(isPlausibleMotionGameScore(60, 60_000)).toBe(true);
  });
});
