import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  analyze: vi.fn(),
  insights: vi.fn(),
}));

vi.mock('@/lib/getApiUserId', () => ({ getApiUserId: async () => 'user-1' }));
vi.mock('@/lib/bojiDetector', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bojiDetector')>();
  return {
    ...actual,
    consumeBojiQuota: async () => ({ allowed: true, retryAfterSeconds: 0 }),
    analyzeWithBojiService: (...args: unknown[]) => mocks.analyze(...args),
  };
});
vi.mock('@/lib/bojiScores', () => ({ buildBojiInsights: (...args: unknown[]) => mocks.insights(...args) }));

import { POST } from './route';

function upload(query = '') {
  return new Request(`http://localhost/api/toolbox/boji/analyze${query}`, {
    method: 'POST',
    body: new Uint8Array([1, 2]),
    headers: { 'Content-Type': 'image/jpeg' },
  }) as any;
}

beforeEach(() => {
  mocks.analyze.mockReset().mockResolvedValue({ report: { metrics: {} }, messages: {} });
  mocks.insights.mockReset().mockResolvedValue({ scoreId: 's-1', percentile: null, lookalike: null, challenge: null });
});

describe('POST /api/toolbox/boji/analyze insights', () => {
  it('attaches insights and passes the PK id through', async () => {
    const res = await POST(upload('?challenge=abc'));
    const body = await res.json();
    expect(body.data.insights).toEqual({ scoreId: 's-1', percentile: null, lookalike: null, challenge: null });
    expect(mocks.insights.mock.calls[0][0]).toMatchObject({ userId: 'user-1', challengeId: 'abc' });
  });

  it('returns the plain analysis when insights fail', async () => {
    mocks.insights.mockRejectedValueOnce(new Error('db down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await POST(upload());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.insights).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });
});
