/**
 * 小程序码（getwxacodeunlimit）。access token 用 stable_token 接口获取：
 * 它不会让其他地方（微信登录、街健点位码）已缓存的 token 失效，
 * 普通的 cgi-bin/token 每取一次都会让旧 token 在 5 分钟后作废。
 */

const VALID_ENV_VERSIONS = new Set(['release', 'trial', 'develop']);

let cachedToken: string | null = null;
let cachedTokenExpiresAt = 0;

type FetchLike = typeof fetch;

export async function getStableMiniappAccessToken(fetchImpl: FetchLike = fetch, now = Date.now()): Promise<string> {
  if (cachedToken && cachedTokenExpiresAt > now + 60_000) return cachedToken;
  const appid = String(process.env.WECHAT_MINIAPP_APPID || '').trim();
  const secret = String(process.env.WECHAT_MINIAPP_SECRET || '').trim();
  if (!appid || !secret) throw new Error('Missing WECHAT_MINIAPP_APPID or WECHAT_MINIAPP_SECRET');
  const resp = await fetchImpl('https://api.weixin.qq.com/cgi-bin/stable_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credential', appid, secret, force_refresh: false }),
    cache: 'no-store',
  });
  const json = (await resp.json().catch(() => null)) as { access_token?: string; expires_in?: number; errmsg?: string } | null;
  if (!resp.ok || !json?.access_token) throw new Error(json?.errmsg || 'Failed to get miniapp access token');
  cachedToken = json.access_token;
  cachedTokenExpiresAt = now + Number(json.expires_in || 7200) * 1000;
  return cachedToken;
}

export function resolveMiniappEnvVersion(requested: string | null | undefined, env: Record<string, string | undefined> = process.env): string {
  const asked = String(requested || '').trim();
  if (VALID_ENV_VERSIONS.has(asked)) return asked;
  const fallback = String(env.WECHAT_MINIAPP_QRCODE_ENV || (env.NODE_ENV === 'production' ? 'release' : 'develop')).trim();
  return VALID_ENV_VERSIONS.has(fallback) ? fallback : 'release';
}

export class MiniappCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MiniappCodeError';
  }
}

/** 返回 PNG 字节。scene 最长 32 个可见字符，page 不带开头的斜杠。 */
export async function fetchMiniappCode(
  { scene, page, envVersion, width = 280 }: { scene: string; page: string; envVersion: string; width?: number },
  fetchImpl: FetchLike = fetch,
): Promise<ArrayBuffer> {
  const token = await getStableMiniappAccessToken(fetchImpl);
  const resp = await fetchImpl(`https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scene, page, check_path: false, env_version: envVersion, width }),
  });
  const contentType = resp.headers.get('content-type') || '';
  if (!resp.ok || contentType.includes('application/json')) {
    const err = (await resp.json().catch(() => null)) as { errmsg?: string } | null;
    throw new MiniappCodeError(err?.errmsg || `getwxacodeunlimit status ${resp.status}`);
  }
  return resp.arrayBuffer();
}

/** 仅测试用 */
export function resetMiniappTokenCacheForTests() {
  cachedToken = null;
  cachedTokenExpiresAt = 0;
}
