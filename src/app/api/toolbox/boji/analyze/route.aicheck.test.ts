import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ analyze: vi.fn(), check: vi.fn() }));

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
vi.mock('@/lib/bojiAbsCheck', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bojiAbsCheck')>();
  return { ...actual, checkAbsWithVision: (...args: unknown[]) => mocks.check(...args) };
});

import { POST } from './route';

const upload = (query = '') => new Request(`http://localhost/api/toolbox/boji/analyze${query}`, {
  method: 'POST', body: new Uint8Array([1]), headers: { 'Content-Type': 'image/jpeg' },
}) as any;

beforeEach(() => {
  mocks.analyze.mockReset().mockResolvedValue({ report: { metrics: { abs: { status: 'ok' } } }, messages: {}, abdomen_crop: 'CROP' });
  mocks.check.mockReset().mockImplementation(async ({ analysis }: { analysis: unknown }) => ({ ...(analysis as object), checked: true }));
});

describe('POST /api/toolbox/boji/analyze AI abs check', () => {
  it('asks for the crop for men, passes it to the check and never returns it', async () => {
    const res = await POST(upload());
    const body = await res.json();
    expect(mocks.analyze.mock.calls[0][4]).toEqual({ abdomenCrop: true });
    expect(mocks.check.mock.calls[0][0]).toMatchObject({ cropBase64: 'CROP', sex: 'male' });
    expect(body.data.checked).toBe(true);
    expect(JSON.stringify(body)).not.toContain('CROP');
  });

  it('does not ask for the crop for the female profile', async () => {
    await POST(upload('?sex=female'));
    expect(mocks.analyze.mock.calls[0][4]).toEqual({ abdomenCrop: false });
  });

  it('returns the engine result when the check throws', async () => {
    mocks.check.mockRejectedValueOnce(new Error('boom'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await POST(upload());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.report.metrics.abs.status).toBe('ok');
      expect(JSON.stringify(body)).not.toContain('CROP');
    } finally {
      spy.mockRestore();
    }
  });
});
