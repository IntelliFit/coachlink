import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  code: vi.fn(),
}));

vi.mock('@/lib/bojiScores', () => ({ supabaseBojiScoreStore: () => ({ find: mocks.find }) }));
vi.mock('@/lib/miniappCode', () => ({
  fetchMiniappCode: (...args: unknown[]) => mocks.code(...args),
  resolveMiniappEnvVersion: (v: string | null) => v || 'release',
}));

import { GET } from './route';

const ID = '3f2b1c4d-1111-4a2b-8c3d-1234567890ab';
const get = (query: string) => GET(new Request(`http://localhost/api/miniapp/qrcode/boji-challenge${query}`) as any);

beforeEach(() => {
  mocks.find.mockReset().mockResolvedValue({ id: ID });
  mocks.code.mockReset().mockResolvedValue(new Uint8Array([137, 80]).buffer);
});

describe('GET /api/miniapp/qrcode/boji-challenge', () => {
  it('returns the PNG with the score id as a 32-character scene', async () => {
    const res = await get(`?id=${ID}&envVersion=trial`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(mocks.code.mock.calls[0][0]).toMatchObject({ scene: ID.replace(/-/g, ''), page: 'toolbox/boji/index', envVersion: 'trial' });
  });

  it('rejects malformed ids without touching the database or WeChat', async () => {
    expect((await get('?id=abc')).status).toBe(400);
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.code).not.toHaveBeenCalled();
  });

  it('does not call WeChat for a score that does not exist', async () => {
    mocks.find.mockResolvedValue(null);
    expect((await get(`?id=${ID}`)).status).toBe(404);
    expect(mocks.code).not.toHaveBeenCalled();
  });

  it('maps WeChat failures to 502', async () => {
    mocks.code.mockRejectedValue(new Error('invalid page'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await get(`?id=${ID}`)).status).toBe(502);
    } finally {
      spy.mockRestore();
    }
  });
});
