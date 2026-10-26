import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchMiniappCode,
  getStableMiniappAccessToken,
  MiniappCodeError,
  resetMiniappTokenCacheForTests,
  resolveMiniappEnvVersion,
} from './miniappCode';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  resetMiniappTokenCacheForTests();
  vi.stubEnv('WECHAT_MINIAPP_APPID', 'wx-test');
  vi.stubEnv('WECHAT_MINIAPP_SECRET', 'secret-test');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getStableMiniappAccessToken', () => {
  it('uses the stable_token endpoint without forcing a refresh, and caches the token', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ access_token: 'tok', expires_in: 7200 }));
    expect(await getStableMiniappAccessToken(fetchImpl as any, 0)).toBe('tok');
    expect(await getStableMiniappAccessToken(fetchImpl as any, 1000)).toBe('tok');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/cgi-bin/stable_token');
    expect(JSON.parse(String(init.body))).toMatchObject({ grant_type: 'client_credential', force_refresh: false });
  });

  it('fails clearly without credentials', async () => {
    vi.stubEnv('WECHAT_MINIAPP_SECRET', '');
    await expect(getStableMiniappAccessToken(vi.fn() as any)).rejects.toThrow('Missing');
  });
});

describe('fetchMiniappCode', () => {
  it('returns the PNG bytes', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok', expires_in: 7200 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'Content-Type': 'image/png' } }));
    const png = await fetchMiniappCode({ scene: 'abc', page: 'toolbox/boji/index', envVersion: 'trial' }, fetchImpl as any);
    expect(Array.from(new Uint8Array(png))).toEqual([137, 80, 78, 71]);
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1].body))).toMatchObject({ scene: 'abc', page: 'toolbox/boji/index', env_version: 'trial' });
  });

  it('turns a WeChat JSON error into MiniappCodeError', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'tok', expires_in: 7200 }))
      .mockResolvedValueOnce(jsonResponse({ errcode: 41030, errmsg: 'invalid page' }));
    await expect(fetchMiniappCode({ scene: 'a', page: 'x', envVersion: 'release' }, fetchImpl as any)).rejects.toBeInstanceOf(MiniappCodeError);
  });
});

describe('resolveMiniappEnvVersion', () => {
  it('accepts known versions and falls back by environment', () => {
    expect(resolveMiniappEnvVersion('trial')).toBe('trial');
    expect(resolveMiniappEnvVersion('bogus', { NODE_ENV: 'production' })).toBe('release');
    expect(resolveMiniappEnvVersion(null, { NODE_ENV: 'development' })).toBe('develop');
    expect(resolveMiniappEnvVersion(null, { WECHAT_MINIAPP_QRCODE_ENV: 'trial' })).toBe('trial');
  });
});
