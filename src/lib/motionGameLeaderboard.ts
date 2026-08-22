export const MOTION_GAME_KEYS = ['pullup-rush', 'pushup-dash'] as const;

export type MotionGameKey = (typeof MOTION_GAME_KEYS)[number];

export const MOTION_GAME_CONFIG: Record<MotionGameKey, {
  templateId: string;
  templateType: string;
}> = {
  'pullup-rush': {
    templateId: 'b7bc1548-08ed-4f52-90cc-f5b22a785101',
    templateType: 'motion_game_pullup',
  },
  'pushup-dash': {
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

export function isPlausibleMotionGameScore(score: number, elapsedMs: number): boolean {
  // Pipes are spawned every 1180ms. This deliberately allows substantial timer
  // jitter while rejecting impossible scores submitted by a modified client.
  const generousMaximum = Math.floor(elapsedMs / 800) + 3;
  return score <= generousMaximum;
}
