/**
 * 腾讯云 COS 统一工具（替代 Supabase Storage）
 *
 * - 逻辑桶名沿用原 Supabase 桶名（videos / avatars / chat-images / ...），
 *   内部映射到实际 COS 桶 + key 前缀（与迁移脚本一致：assets / receipts 为合并桶，用前缀区分）。
 * - 新文件 key 统一按 `年/月/日/` 分目录。
 * - 公有桶通过 CDN 域名访问；私有桶（receipts）通过预签名 URL 访问。
 *
 * 注意：桶映射与 Supabase→CDN 解析等**纯逻辑**已抽到 `./storageUrl`（不依赖 COS SDK），
 * 本文件只在其上叠加需要 `cos-nodejs-sdk-v5` 的上传/删除/签名能力。需要纯解析逻辑的地方
 * （如 instrumentation 全局兼容层）应直接 import `@/lib/storageUrl`，避免把 Node-only 的
 * COS SDK 拉进 webpack 包（否则报 `Can't resolve 'stream'`）。
 *
 * 环境变量见 .env.development：
 *   COS_REGION / COS_SECRET_ID / COS_SECRET_KEY / COS_APPID
 *   COS_CDN_VIDEOS / COS_CDN_AVATARS / COS_CDN_CHAT_IMAGES / COS_CDN_ASSETS / COS_CDN_RECEIPTS
 */

import COS from "cos-nodejs-sdk-v5";
import { v4 as uuidv4 } from "uuid";
import { BUCKET_MAP, COS_REGION, buildPublicUrl, parseCosUrl, type LogicalBucket } from "./storageUrl";

// 透传纯逻辑，保持既有 `@/lib/cos` 引用不破。
export {
  COS_REGION,
  BUCKET_MAP,
  buildPublicUrl,
  parseCosUrl,
  extractFromSupabaseUrl,
  resolveStorageUrl,
  resolveMediaDeep,
} from "./storageUrl";
export type { LogicalBucket, BucketConfig } from "./storageUrl";

function env(name: string): string {
  return (process.env[name] || "").trim();
}

let _cos: COS | null = null;
export function getCos(): COS {
  if (!_cos) {
    const SecretId = env("COS_SECRET_ID");
    const SecretKey = env("COS_SECRET_KEY");
    if (!SecretId || !SecretKey) {
      throw new Error("COS_SECRET_ID / COS_SECRET_KEY 未配置");
    }
    _cos = new COS({ SecretId, SecretKey });
  }
  return _cos;
}

/**
 * 生成按 年/月/日 分目录的对象 key（不含桶前缀）。
 * @param ext 文件扩展名（不含点）
 * @param segments 可选的语义子目录（如 userId、"coach-actions"）。会放在日期目录之前。
 */
export function buildDatedKey(ext: string, ...segments: (string | undefined | null)[]): string {
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const fileName = `${Date.now()}-${uuidv4()}.${ext.replace(/^\./, "").toLowerCase()}`;
  const dirs = segments.filter((s): s is string => Boolean(s && s.trim()));
  return [...dirs, y, m, d, fileName].join("/");
}

/** 上传 buffer 到 COS，返回可访问 URL */
export async function cosUpload(
  logical: LogicalBucket,
  key: string,
  body: Buffer | Uint8Array,
  options?: { contentType?: string; cacheControl?: string },
): Promise<{ url: string; bucket: string; key: string }> {
  const cfg = BUCKET_MAP[logical];
  const fullKey = cfg.prefix + key;
  const Body = Buffer.isBuffer(body) ? body : Buffer.from(body);
  await new Promise<void>((resolve, reject) => {
    getCos().putObject(
      {
        Bucket: cfg.cosBucket,
        Region: COS_REGION,
        Key: fullKey,
        Body,
        ContentLength: Body.length,
        ...(options?.contentType ? { ContentType: options.contentType } : {}),
        ...(options?.cacheControl !== undefined ? { CacheControl: options.cacheControl } : {}),
      },
      (err) => (err ? reject(err) : resolve()),
    );
  });
  return { url: buildPublicUrl(logical, key), bucket: cfg.cosBucket, key };
}

/** 删除对象（key 为不含桶前缀的业务 key） */
export async function cosRemove(logical: LogicalBucket, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const cfg = BUCKET_MAP[logical];
  await new Promise<void>((resolve, reject) => {
    getCos().deleteMultipleObject(
      {
        Bucket: cfg.cosBucket,
        Region: COS_REGION,
        Objects: keys.map((k) => ({ Key: cfg.prefix + k })),
      },
      (err) => (err ? reject(err) : resolve()),
    );
  });
}

/** 生成客户端直传用的预签名 PUT URL */
export async function cosPresignedPutUrl(
  logical: LogicalBucket,
  key: string,
  options?: { expiresSec?: number; contentType?: string },
): Promise<{ uploadUrl: string; url: string; bucket: string; key: string }> {
  const cfg = BUCKET_MAP[logical];
  const fullKey = cfg.prefix + key;
  const uploadUrl = await new Promise<string>((resolve, reject) => {
    getCos().getObjectUrl(
      {
        Bucket: cfg.cosBucket,
        Region: COS_REGION,
        Key: fullKey,
        Method: "PUT",
        Sign: true,
        Expires: options?.expiresSec ?? 3600,
      },
      (err, data) => (err ? reject(err) : resolve(data.Url)),
    );
  });
  return { uploadUrl, url: buildPublicUrl(logical, key), bucket: cfg.cosBucket, key };
}

/** 根据完整访问 URL 删除 COS 对象（自动识别桶；无法识别的 URL 会被忽略） */
export async function cosRemoveByUrl(urls: string[]): Promise<void> {
  const byBucket = new Map<string, string[]>();
  for (const u of urls) {
    const parsed = parseCosUrl(u);
    if (!parsed) continue;
    const arr = byBucket.get(parsed.cosBucket) || [];
    arr.push(parsed.key);
    byBucket.set(parsed.cosBucket, arr);
  }
  for (const [cosBucket, keys] of byBucket) {
    if (keys.length === 0) continue;
    await new Promise<void>((resolve, reject) => {
      getCos().deleteMultipleObject(
        { Bucket: cosBucket, Region: COS_REGION, Objects: keys.map((k) => ({ Key: k })) },
        (err) => (err ? reject(err) : resolve()),
      );
    });
  }
}

/** 生成私有对象的预签名 GET URL（用于 receipts 等私有桶的临时访问） */
export async function cosPresignedGetUrl(
  logical: LogicalBucket,
  key: string,
  options?: { expiresSec?: number },
): Promise<string> {
  const cfg = BUCKET_MAP[logical];
  const fullKey = cfg.prefix + key;
  return new Promise<string>((resolve, reject) => {
    getCos().getObjectUrl(
      {
        Bucket: cfg.cosBucket,
        Region: COS_REGION,
        Key: fullKey,
        Method: "GET",
        Sign: true,
        Expires: options?.expiresSec ?? 3600,
      },
      (err, data) => (err ? reject(err) : resolve(data.Url)),
    );
  });
}
