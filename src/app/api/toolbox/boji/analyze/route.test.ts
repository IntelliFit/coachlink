import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userId: 'user-1' as string | null,
  quota: { allowed: true, retryAfterSeconds: 0 },
  analyze: vi.fn(),
}));

vi.mock('@/lib/getApiUserId', () => ({ getApiUserId: async () => mocks.userId }));

vi.mock('@/lib/bojiDetector', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bojiDetector')>();
  return {
    ...actual,
    consumeBojiQuota: async () => mocks.quota,
    analyzeWithBojiService: (...args: unknown[]) => mocks.analyze(...args),
  };
});

import { BojiServiceError } from '@/lib/bojiDetector';
import { POST } from './route';

function upload(body: BodyInit | null, type = 'image/jpeg') {
  return new Request('http://localhost/api/toolbox/boji/analyze', {
    method: 'POST',
    body,
    headers: { 'Content-Type': type },
  }) as any;
}

beforeEach(() => {
  mocks.userId = 'user-1';
  mocks.quota = { allowed: true, retryAfterSeconds: 0 };
  mocks.analyze.mockReset();
  mocks.analyze.mockResolvedValue({ report: { metrics: {} }, messages: {} });
});

describe('POST /api/toolbox/boji/analyze', () => {
  it('requires login', async () => {
    mocks.userId = null;
    const res = await POST(upload(new Uint8Array([1])));
    expect(res.status).toBe(401);
    expect(mocks.analyze).not.toHaveBeenCalled();
  });

  it('forwards the photo bytes and wraps the analysis', async () => {
    const res = await POST(upload(new Uint8Array([7, 8, 9])));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ success: true, data: { report: { metrics: {} } } });
    expect(Array.from(mocks.analyze.mock.calls[0][0] as Uint8Array)).toEqual([7, 8, 9]);
  });

  it('rejects other content types and empty bodies', async () => {
    expect((await POST(upload('hello', 'text/plain'))).status).toBe(415);
    expect((await POST(upload(new Uint8Array([])))).status).toBe(400);
    expect(mocks.analyze).not.toHaveBeenCalled();
  });

  it('rejects photos over the size limit', async () => {
    vi.stubEnv('BOJI_MAX_UPLOAD_MB', '0.001');
    try {
      const res = await POST(upload(new Uint8Array(4096)));
      expect(res.status).toBe(413);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('returns 429 with Retry-After when the hourly quota is used up', async () => {
    mocks.quota = { allowed: false, retryAfterSeconds: 600 };
    const res = await POST(upload(new Uint8Array([1])));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('600');
    expect((await res.json()).message).toContain('10 分钟');
  });

  it('maps service errors to user-facing statuses', async () => {
    mocks.analyze.mockRejectedValueOnce(new BojiServiceError('bad_image', 'x'));
    expect((await POST(upload(new Uint8Array([1])))).status).toBe(400);
    mocks.analyze.mockRejectedValueOnce(new BojiServiceError('unavailable', 'x'));
    const res = await POST(upload(new Uint8Array([1])));
    expect(res.status).toBe(503);
    expect((await res.json()).message).toContain('暂时不可用');
  });
});
