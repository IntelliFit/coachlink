export const MOTION_GAME_KEYS = ['happy-bird', 'pullup-rush', 'pushup-dash'] as const;

export type MotionGameKey = (typeof MOTION_GAME_KEYS)[number];

export const MOTION_GAME_CONFIG: Record<MotionGameKey, {
  actionLabel: string;
  scoreLabel: string;
  templateId: string;
  templateType: string;
}> = {
  'happy-bird': {
    actionLabel: '动作次数',
    scoreLabel: '得分',
    templateId: 'b7bc1548-08ed-4f52-90cc-f5b22a785103',
    templateType: 'motion_game_bird',
  },
  'pullup-rush': {
    actionLabel: '引体次数',
    scoreLabel: '穿越通道',
    templateId: 'b7bc1548-08ed-4f52-90cc-f5b22a785101',
    templateType: 'motion_game_pullup',
  },
  'pushup-dash': {
    actionLabel: '俯卧撑次数',
    scoreLabel: '穿越通道',
    templateId: 'b7bc1548-08ed-4f52-90cc-f5b22a785102',
    templateType: 'motion_game_pushup',
  },
};

export function isMotionGameKey(value: unknown): value is MotionGameKey {
  return typeof value === 'string' && MOTION_GAME_KEYS.includes(value as MotionGameKey);
}

export function parseNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return null;
  return value;
}

export function parseLockRatio(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) return null;
  return Math.round(value * 10_000) / 10_000;
}

export function isPlausibleMotionGameScore(
  score: number,
  elapsedMs: number,
  gameKey: MotionGameKey = 'pullup-rush',
): boolean {
  if (gameKey === 'happy-bird') {
    // 快乐小鸟的分数含门、完美、能量豆、动作和燃爆翻倍。地狱难度下全部拿满约 76 分/秒，
    // 这里放宽到 120 分/秒，只拦改包提交的离谱成绩。
    return score <= Math.floor(elapsedMs / 1000) * 120 + 200;
  }
  // Pipes are spawned every 1180ms. This deliberately allows substantial timer
  // jitter while rejecting impossible scores submitted by a modified client.
  const generousMaximum = Math.floor(elapsedMs / 800) + 3;
  return score <= generousMaximum;
}
