/**
 * 腾讯云 COS 统一工具（替代 Supabase Storage）
 *
 * - 逻辑桶名沿用原 Supabase 桶名（videos / avatars / chat-images / ...），
 *   内部映射到实际 COS 桶 + key 前缀（与迁移脚本一致：assets / receipts 为合并桶，用前缀区分）。
 * - 新文件 key 统一按 `年/月/日/` 分目录。
 * - 公有桶通过 CDN 域名访问；私有桶（receipts）通过预签名 URL 访问。
 *
 * 环境变量见 .env.development：
 *   COS_REGION / COS_SECRET_ID / COS_SECRET_KEY / COS_APPID
 *   COS_CDN_VIDEOS / COS_CDN_AVATARS / COS_CDN_CHAT_IMAGES / COS_CDN_ASSETS
 */

import COS from "cos-nodejs-sdk-v5";
import { v4 as uuidv4 } from "uuid";

function env(name: string): string {
  return (process.env[name] || "").trim();
}

export const COS_REGION = env("COS_REGION") || "ap-beijing";
const COS_APPID = env("COS_APPID") || "1370036754";

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

/** 逻辑桶名（沿用原 Supabase 桶名，调用方无需关心实际 COS 桶） */
export type LogicalBucket =
  | "videos"
  | "avatars"
  | "chat-images"
  | "coach-posters"
  | "knowledge-assets"
  | "streetlifting-locations"
  | "receipts"
  | "payment-qrcodes";

type BucketConfig = {
  cosBucket: string;
  /** 合并桶用前缀区分来源（与迁移脚本完全一致） */
  prefix: string;
  /** 公有桶的 CDN 访问域名（含协议），私有桶为空 */
  cdnBase: string;
  isPrivate: boolean;
};

const bucket = (name: string) => `coachlink-${name}-${COS_APPID}`;

export const BUCKET_MAP: Record<LogicalBucket, BucketConfig> = {
  videos: { cosBucket: bucket("videos"), prefix: "", cdnBase: env("COS_CDN_VIDEOS"), isPrivate: false },
  avatars: { cosBucket: bucket("user-avatars"), prefix: "", cdnBase: env("COS_CDN_AVATARS"), isPrivate: false },
  "chat-images": { cosBucket: bucket("chat-images"), prefix: "", cdnBase: env("COS_CDN_CHAT_IMAGES"), isPrivate: false },
  "coach-posters": { cosBucket: bucket("assets"), prefix: "coach-posters/", cdnBase: env("COS_CDN_ASSETS"), isPrivate: false },
  "knowledge-assets": { cosBucket: bucket("assets"), prefix: "knowledge-assets/", cdnBase: env("COS_CDN_ASSETS"), isPrivate: false },
  "streetlifting-locations": { cosBucket: bucket("assets"), prefix: "streetlifting-locations/", cdnBase: env("COS_CDN_ASSETS"), isPrivate: false },
  receipts: { cosBucket: bucket("receipts"), prefix: "receipts/", cdnBase: env("COS_CDN_RECEIPTS"), isPrivate: !env("COS_CDN_RECEIPTS") },
  "payment-qrcodes": { cosBucket: bucket("receipts"), prefix: "payment-qrcodes/", cdnBase: env("COS_CDN_RECEIPTS"), isPrivate: !env("COS_CDN_RECEIPTS") },
};

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
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

const LOGICAL_BUCKETS = Object.keys(BUCKET_MAP) as LogicalBucket[];

function isLogicalBucket(s: string): s is LogicalBucket {
  return (LOGICAL_BUCKETS as string[]).includes(s);
}

/**
 * 从历史 Supabase Storage URL 中提取 { 逻辑桶, key }。
 * 形如 https://xxx.supabase.co/storage/v1/object/public/<bucket>/<path>（也兼容 /sign/、/render/image/public/）。
 */
export function extractFromSupabaseUrl(url: string): { logical: LogicalBucket; key: string } | null {
  const markers = [
    "/storage/v1/object/public/",
    "/storage/v1/object/sign/",
    "/storage/v1/render/image/public/",
    "/storage/v1/object/",
  ];
  for (const marker of markers) {
    const idx = url.indexOf(marker);
    if (idx === -1) continue;
    const rest = url.slice(idx + marker.length).split("?")[0];
    const slash = rest.indexOf("/");
    if (slash === -1) continue;
    const bucket = rest.slice(0, slash);
    const path = rest.slice(slash + 1);
    if (isLogicalBucket(bucket) && path) {
      return { logical: bucket, key: decodeURIComponent(path) };
    }
  }
  return null;
}

/**
 * 媒体引用统一解析为可访问 URL（兼容层）。输入可能是：
 * - 业务 key：`<逻辑桶>/<path>`（推荐的新存储格式）→ 直接拼 CDN
 * - 历史 Supabase URL → 提取桶与 path 后拼 CDN
 * - 已是 CDN/外部 http(s) URL → 原样返回
 * - 空 → 原样返回
 */
export function resolveStorageUrl(value: string | null | undefined): string {
  if (!value) return value ?? "";
  const v = String(value).trim();
  if (!v) return v;

  if (/^https?:\/\//i.test(v)) {
    const extracted = extractFromSupabaseUrl(v);
    if (extracted) return buildPublicUrl(extracted.logical, extracted.key);
    return v; // 已是 CDN 或外部链接
  }

  // 视为业务 key：第一段是逻辑桶
  const normalized = v.replace(/^\/+/, "");
  const slash = normalized.indexOf("/");
  if (slash > 0) {
    const bucket = normalized.slice(0, slash);
    const key = normalized.slice(slash + 1);
    if (isLogicalBucket(bucket) && key) return buildPublicUrl(bucket, key);
  }
  return v;
}

/**
 * 由逻辑桶 + 业务 key 计算最终访问 URL。
 * 强制走 CDN 域名：未配置对应 COS_CDN_* 时直接抛错，**绝不回退到 COS 源站域名**（*.myqcloud.com 源站对外不可用）。
 */
export function buildPublicUrl(logical: LogicalBucket, key: string): string {
  const cfg = BUCKET_MAP[logical];
  const fullKey = encodeKey(cfg.prefix + key);
  if (!cfg.cdnBase) {
    throw new Error(
      `[cos] 逻辑桶 "${logical}" 未配置 CDN 域名（缺少对应的 COS_CDN_* 环境变量）；` +
        `按规范必须使用 CDN 域名，拒绝回退到 COS 源站域名。请在运行时配置该 CDN 环境变量。`,
    );
  }
  let base = cfg.cdnBase.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
  return `${base}/${fullKey}`;
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

/** 把一个 CDN/COS URL 反解为 { cosBucket, key }（key 含桶前缀），无法识别返回 null */
export function parseCosUrl(url: string): { cosBucket: string; key: string } | null {
  if (!url) return null;
  for (const cfg of Object.values(BUCKET_MAP)) {
    const bases: string[] = [];
    if (cfg.cdnBase) bases.push(cfg.cdnBase.replace(/\/+$/, ""));
    bases.push(`https://${cfg.cosBucket}.cos.${COS_REGION}.myqcloud.com`);
    for (const base of bases) {
      if (url.startsWith(base + "/")) {
        const rest = url.slice(base.length + 1).split("?")[0];
        return { cosBucket: cfg.cosBucket, key: decodeURIComponent(rest) };
      }
    }
  }
  return null;
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
