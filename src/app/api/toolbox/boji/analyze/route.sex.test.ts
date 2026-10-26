import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ analyze: vi.fn() }));

vi.mock('@/lib/getApiUserId', () => ({ getApiUserId: async () => 'user-1' }));
vi.mock('@/lib/bojiDetector', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bojiDetector')>();
  return {
    ...actual,
    consumeBojiQuota: async () => ({ allowed: true, retryAfterSeconds: 0 }),
    analyzeWithBojiService: (...args: unknown[]) => mocks.analyze(...args),
  };
});
vi.mock('@/lib/bojiScores', () => ({ buildBojiInsights: async () => ({ scoreId: null, percentile: null, lookalike: null, challenge: null }) }));

import { POST } from './route';

function upload(query: string) {
  return new Request(`http://localhost/api/toolbox/boji/analyze${query}`, {
    method: 'POST',
    body: new Uint8Array([1]),
    headers: { 'Content-Type': 'image/jpeg' },
  }) as any;
}

beforeEach(() => {
  mocks.analyze.mockReset().mockResolvedValue({ report: { metrics: {} }, messages: {} });
});

describe('POST /api/toolbox/boji/analyze sex', () => {
  it('passes female through and falls back to male for anything else', async () => {
    await POST(upload('?sex=female'));
    await POST(upload('?sex=robot'));
    await POST(upload(''));
    expect(mocks.analyze.mock.calls.map((c) => c[3])).toEqual(['female', 'male', 'male']);
  });
});
