import { describe, expect, it, vi } from 'vitest';
import {
  analyzeWithBojiService,
  BojiServiceError,
  consumeBojiQuota,
  getBojiConfig,
  isAllowedContentType,
  normalizeContentType,
} from './bojiDetector';

const config = getBojiConfig({ BOJI_SERVICE_URL: 'http://boji.test/', BOJI_SERVICE_TOKEN: 'tok' });
const analysis = { report: { metrics: {}, total: { score: 80 } }, messages: {} };

function respond(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe('getBojiConfig', () => {
  it('uses the cluster service in production and localhost in development', () => {
    expect(getBojiConfig({ NODE_ENV: 'production' }).serviceUrl).toBe('http://coachlink-boji-service-main:8000');
    expect(getBojiConfig({ NODE_ENV: 'development' }).serviceUrl).toBe('http://127.0.0.1:8765');
  });

  it('reads overrides and ignores invalid numbers', () => {
    const c = getBojiConfig({ BOJI_SERVICE_URL: 'http://x:1//', BOJI_MAX_UPLOAD_MB: '2', BOJI_HOURLY_LIMIT: 'abc' });
    expect(c.serviceUrl).toBe('http://x:1');
    expect(c.maxUploadBytes).toBe(2 * 1024 * 1024);
    expect(c.hourlyLimit).toBe(30);
  });
});

describe('content type', () => {
  it('accepts photos and raw bytes only', () => {
    expect(isAllowedContentType(normalizeContentType('image/JPEG; charset=binary'))).toBe(true);
    expect(isAllowedContentType(normalizeContentType('application/octet-stream'))).toBe(true);
    expect(isAllowedContentType(normalizeContentType('text/plain'))).toBe(false);
    expect(isAllowedContentType(normalizeContentType(null))).toBe(false);
  });
});

describe('consumeBojiQuota', () => {
  function fakeStore() {
    const counts = new Map<string, number>();
    const expire = vi.fn(async () => true);
    return {
      expire,
      store: async () => ({
        incr: async (key: string) => {
          const next = (counts.get(key) ?? 0) + 1;
          counts.set(key, next);
          return next;
        },
        expire,
      }),
    };
  }

  it('allows up to the limit within an hour, then reports when to retry', async () => {
    const { store, expire } = fakeStore();
    const now = () => Date.UTC(2026, 9, 22, 10, 15, 0);
    const results = [];
    for (let i = 0; i < 3; i += 1) results.push(await consumeBojiQuota('u1', 2, { store, now }));
    expect(results.map((r) => r.allowed)).toEqual([true, true, false]);
    expect(results[2].retryAfterSeconds).toBe(45 * 60);
    expect(expire).toHaveBeenCalledTimes(1);
  });

  it('counts users separately and resets next hour', async () => {
    const { store } = fakeStore();
    let t = Date.UTC(2026, 9, 22, 10, 59, 0);
    const now = () => t;
    await consumeBojiQuota('u1', 1, { store, now });
    expect((await consumeBojiQuota('u2', 1, { store, now })).allowed).toBe(true);
    expect((await consumeBojiQuota('u1', 1, { store, now })).allowed).toBe(false);
    t += 2 * 60 * 1000;
    expect((await consumeBojiQuota('u1', 1, { store, now })).allowed).toBe(true);
  });

  it('falls back to in-process counting when Redis is unavailable', async () => {
    const store = async () => {
      throw new Error('REDIS_URL not set');
    };
    const now = () => Date.UTC(2026, 9, 22, 11, 0, 0);
    expect((await consumeBojiQuota('offline-user', 1, { store, now })).allowed).toBe(true);
    expect((await consumeBojiQuota('offline-user', 1, { store, now })).allowed).toBe(false);
  });
});

describe('analyzeWithBojiService', () => {
  it('posts the raw photo with the service token and returns the analysis', async () => {
    const fetchImpl = respond(200, analysis);
    const result = await analyzeWithBojiService(new Uint8Array([1, 2, 3]), config, fetchImpl);
    expect(result).toEqual(analysis);
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('http://boji.test/v1/analyze');
    expect(init.headers['X-Boji-Token']).toBe('tok');
    expect(init.headers['Content-Type']).toBe('application/octet-stream');
  });

  it.each([
    [400, 'bad_image'],
    [413, 'too_large'],
    [500, 'unavailable'],
    [401, 'unavailable'],
  ])('maps service status %i to %s', async (status, kind) => {
    await expect(analyzeWithBojiService(new Uint8Array([1]), config, respond(status, {})))
      .rejects.toMatchObject({ kind });
  });

  it('treats an unexpected body or a network failure as unavailable', async () => {
    await expect(analyzeWithBojiService(new Uint8Array([1]), config, respond(200, { nope: true })))
      .rejects.toBeInstanceOf(BojiServiceError);
    const broken = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    await expect(analyzeWithBojiService(new Uint8Array([1]), config, broken)).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('gives up after the timeout', async () => {
    const hanging = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    })) as unknown as typeof fetch;
    await expect(analyzeWithBojiService(new Uint8Array([1]), { ...config, timeoutMs: 20 }, hanging))
      .rejects.toMatchObject({ kind: 'unavailable', message: 'boji service timeout' });
  });
});
