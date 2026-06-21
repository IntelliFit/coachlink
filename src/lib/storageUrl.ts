/**
 * 存储 URL 纯逻辑（不依赖 cos-nodejs-sdk-v5，可被任意运行时/打包器安全引入）。
 *
 * 这里只放“桶映射 + Supabase→CDN 解析”相关的纯函数，供：
 *  - `src/lib/cos.ts`（再叠加 COS SDK 的上传/删除/签名能力）；
 *  - `src/instrumentation.ts`（全局 Response.json 兼容层，必须避免引入 Node-only 的 COS SDK，
 *    否则 webpack 模式会因 SDK 传递依赖 `request/http-signature/assert-plus` 报 `Can't resolve 'stream'`）。
 *
 * 环境变量：COS_REGION / COS_APPID / COS_CDN_VIDEOS / COS_CDN_AVATARS /
 *           COS_CDN_CHAT_IMAGES / COS_CDN_ASSETS / COS_CDN_RECEIPTS
 */

function env(name: string): string {
  return (process.env[name] || "").trim();
}

export const COS_REGION = env("COS_REGION") || "ap-beijing";
const COS_APPID = env("COS_APPID") || "1370036754";

/** 逻辑桶名（沿用原 Supabase 桶名，调用方无需关心实际 COS 桶） */
export type LogicalBucket =
  | "videos"
  | "avatars"
  | "chat-images"
  | "action-reference-images"
  | "coach-posters"
  | "knowledge-assets"
  | "streetlifting-locations"
  | "receipts"
  | "payment-qrcodes";

export type BucketConfig = {
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
  "action-reference-images": { cosBucket: bucket("assets"), prefix: "action-reference-images/", cdnBase: env("COS_CDN_ASSETS"), isPrivate: false },
  "coach-posters": { cosBucket: bucket("assets"), prefix: "coach-posters/", cdnBase: env("COS_CDN_ASSETS"), isPrivate: false },
  "knowledge-assets": { cosBucket: bucket("assets"), prefix: "knowledge-assets/", cdnBase: env("COS_CDN_ASSETS"), isPrivate: false },
  "streetlifting-locations": { cosBucket: bucket("assets"), prefix: "streetlifting-locations/", cdnBase: env("COS_CDN_ASSETS"), isPrivate: false },
  receipts: { cosBucket: bucket("receipts"), prefix: "receipts/", cdnBase: env("COS_CDN_RECEIPTS"), isPrivate: !env("COS_CDN_RECEIPTS") },
  "payment-qrcodes": { cosBucket: bucket("receipts"), prefix: "payment-qrcodes/", cdnBase: env("COS_CDN_RECEIPTS"), isPrivate: !env("COS_CDN_RECEIPTS") },
};

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

const LOGICAL_BUCKETS = Object.keys(BUCKET_MAP) as LogicalBucket[];

function isLogicalBucket(s: string): s is LogicalBucket {
  return (LOGICAL_BUCKETS as string[]).includes(s);
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
 * 仅把"历史 Supabase Storage URL"就地解析为 CDN URL（用于 API 出口的兼容层）。
 * - 命中我们桶映射的 Supabase 链接 → 转成 CDN；
 * - 其它字符串（已是 CDN、外部链接、普通文本）→ 原样返回；
 * 不处理"裸 key"，避免把普通文本误判（safe_equiv 下新数据存的就是完整 CDN URL）。
 */
function resolveSupabaseUrlOnly(value: string): string {
  if (value.indexOf("/storage/v1/") === -1) return value;
  const extracted = extractFromSupabaseUrl(value);
  if (!extracted) return value;
  try {
    return buildPublicUrl(extracted.logical, extracted.key);
  } catch {
    return value;
  }
}

/**
 * 深度遍历对象/数组，把其中所有"历史 Supabase Storage URL"字符串就地替换为 CDN URL。
 * 用于在 API 返回前统一规整媒体字段，避免前端再去访问 supabase。原值非媒体则原样保留。
 */
export function resolveMediaDeep<T>(input: T, depth = 0): T {
  if (depth > 12 || input == null) return input;
  if (typeof input === "string") return resolveSupabaseUrlOnly(input) as unknown as T;
  if (Array.isArray(input)) {
    return input.map((v) => resolveMediaDeep(v, depth + 1)) as unknown as T;
  }
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = resolveMediaDeep(v, depth + 1);
    }
    return out as unknown as T;
  }
  return input;
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
