import { getRedisClient } from '@/lib/redisClient';
import type { BojiAnalysisDto, BojiSex } from '@coachlink/core/src/bojiDetector';

/**
 * 薄肌检测器的服务端调用：转发照片给集群内的 Python 服务（boji-detector），
 * 照片只在内存中经过，不落盘、不进对象存储、不写日志。
 */

export const BOJI_ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/octet-stream',
] as const;

const DEFAULT_PRODUCTION_URL = 'http://coachlink-boji-service-main:8000';
const DEFAULT_DEVELOPMENT_URL = 'http://127.0.0.1:8765';
const RATE_WINDOW_SECONDS = 60 * 60;

type Env = Record<string, string | undefined>;

function positiveNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export interface BojiConfig {
  serviceUrl: string;
  token: string;
  maxUploadBytes: number;
  hourlyLimit: number;
  timeoutMs: number;
}

export function getBojiConfig(env: Env = process.env): BojiConfig {
  const fallbackUrl = env.NODE_ENV === 'production' ? DEFAULT_PRODUCTION_URL : DEFAULT_DEVELOPMENT_URL;
  return {
    serviceUrl: (env.BOJI_SERVICE_URL?.trim() || fallbackUrl).replace(/\/+$/, ''),
    token: env.BOJI_SERVICE_TOKEN?.trim() || '',
    maxUploadBytes: Math.round(positiveNumber(env.BOJI_MAX_UPLOAD_MB, 8) * 1024 * 1024),
    hourlyLimit: Math.floor(positiveNumber(env.BOJI_HOURLY_LIMIT, 30)),
    timeoutMs: positiveNumber(env.BOJI_TIMEOUT_MS, 20_000),
  };
}

export function normalizeContentType(header: string | null): string {
  return (header || '').split(';')[0].trim().toLowerCase();
}

export function isAllowedContentType(contentType: string): boolean {
  return (BOJI_ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType);
}

// ---------------------------------------------------------------------------
// 频率限制：每人每小时固定窗口。优先用 Redis（多副本共享），连不上时退回进程内计数。
// ---------------------------------------------------------------------------

export interface QuotaResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface CounterStore {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

const memoryCounts = new Map<string, { count: number; expiresAt: number }>();

const memoryStore = (now: () => number): CounterStore => ({
  async incr(key) {
    const t = now();
    for (const [k, v] of memoryCounts) {
      if (v.expiresAt <= t) memoryCounts.delete(k);
    }
    const current = memoryCounts.get(key);
    const next = { count: (current?.count ?? 0) + 1, expiresAt: current?.expiresAt ?? t + RATE_WINDOW_SECONDS * 1000 };
    memoryCounts.set(key, next);
    return next.count;
  },
  async expire() {
    return true;
  },
});

async function redisStore(): Promise<CounterStore> {
  const client = await getRedisClient();
  return {
    incr: (key) => client.incr(key),
    expire: (key, seconds) => client.expire(key, seconds),
  };
}

export async function consumeBojiQuota(
  userId: string,
  limit: number,
  deps: { store?: () => Promise<CounterStore>; now?: () => number } = {},
): Promise<QuotaResult> {
  const now = deps.now ?? Date.now;
  const nowSeconds = now() / 1000;
  const bucket = Math.floor(nowSeconds / RATE_WINDOW_SECONDS);
  const key = `boji:analyze:${userId}:${bucket}`;
  let store: CounterStore;
  try {
    store = await (deps.store ?? redisStore)();
  } catch {
    store = memoryStore(now);
  }
  let count: number;
  try {
    count = await store.incr(key);
    if (count === 1) await store.expire(key, RATE_WINDOW_SECONDS);
  } catch {
    count = await memoryStore(now).incr(key);
  }
  const retryAfterSeconds = Math.max(1, Math.ceil((bucket + 1) * RATE_WINDOW_SECONDS - nowSeconds));
  return count <= limit ? { allowed: true, retryAfterSeconds: 0 } : { allowed: false, retryAfterSeconds };
}

// ---------------------------------------------------------------------------
// 调用 Python 服务
// ---------------------------------------------------------------------------

export type BojiServiceErrorKind = 'bad_image' | 'too_large' | 'unavailable';

export class BojiServiceError extends Error {
  constructor(public readonly kind: BojiServiceErrorKind, message: string) {
    super(message);
    this.name = 'BojiServiceError';
  }
}

function isAnalysis(value: unknown): value is BojiAnalysisDto {
  const v = value as BojiAnalysisDto | null;
  return !!v && typeof v === 'object' && !!v.report && typeof v.report === 'object'
    && !!v.report.metrics && typeof v.report.metrics === 'object'
    && !!v.messages && typeof v.messages === 'object';
}

/** sex：female 用女性档打分（引擎 0.2 起）；旧引擎会忽略这个参数，按男性档返回 */
export async function analyzeWithBojiService(
  photo: Uint8Array,
  config: BojiConfig = getBojiConfig(),
  fetchImpl: typeof fetch = fetch,
  sex: BojiSex = 'male',
): Promise<BojiAnalysisDto> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  let response: Response;
  try {
    const query = sex === 'female' ? '?sex=female' : '';
    response = await fetchImpl(`${config.serviceUrl}/v1/analyze${query}`, {
      method: 'POST',
      body: photo,
      headers: {
        'Content-Type': 'application/octet-stream',
        ...(config.token ? { 'X-Boji-Token': config.token } : {}),
      },
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network';
    throw new BojiServiceError('unavailable', `boji service ${reason}`);
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 400) throw new BojiServiceError('bad_image', 'unreadable image');
  if (response.status === 413) throw new BojiServiceError('too_large', 'image too large');
  if (!response.ok) throw new BojiServiceError('unavailable', `boji service status ${response.status}`);
  const body: unknown = await response.json().catch(() => null);
  if (!isAnalysis(body)) throw new BojiServiceError('unavailable', 'boji service returned an unexpected body');
  return body;
}
