import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

const db = serviceRoleSupabase as any;

export type MotionEffectExportQuality = "standard" | "hd";
export type MotionEffectQueueTier = "standard" | "priority";

export type MotionEffectRequestIdentity = {
  userId: string | null;
  ownerToken: string;
};

function positiveInteger(value: string | undefined, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function commerceSecret() {
  return String(
    process.env.MOTION_EFFECTS_COMMERCE_SECRET ||
      process.env.MOTION_EFFECTS_DOWNLOAD_SECRET ||
      process.env.NEXTAUTH_SECRET ||
      process.env.CRON_SECRET ||
      "",
  ).trim();
}

function requestIp(req: Request) {
  return String(
    req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      "",
  ).trim();
}

export function getMotionEffectPrices() {
  return {
    standardCents: positiveInteger(
      process.env.MOTION_EFFECTS_STANDARD_PRICE_CENTS,
      290,
    ),
    hdCents: positiveInteger(process.env.MOTION_EFFECTS_HD_PRICE_CENTS, 490),
    priorityAddonCents: positiveInteger(
      process.env.MOTION_EFFECTS_PRIORITY_ADDON_CENTS,
      190,
    ),
  };
}

/** 已安装的旧版 APP 和没刷新的网页按报价决定是否下单，报 0 元它们就会直接生成。 */
export const FREE_MOTION_EFFECT_PRICES = {
  standardCents: 0,
  hdCents: 0,
  priorityAddonCents: 0,
};

export function normalizeExportQuality(value: unknown): MotionEffectExportQuality {
  return value === "hd" ? "hd" : "standard";
}

export function normalizeQueueTier(value: unknown): MotionEffectQueueTier {
  return value === "priority" ? "priority" : "standard";
}

export function createMotionEffectOwnerToken() {
  return randomBytes(32).toString("base64url");
}

export function hashMotionEffectOwnerToken(token: string) {
  const secret = commerceSecret();
  if (!secret) {
    throw new Error("MOTION_EFFECTS_COMMERCE_SECRET 未配置");
  }
  return createHmac("sha256", secret).update(token).digest("hex");
}

export function createMotionEffectClientKey(req: Request) {
  const rawClientId = String(req.headers.get("x-motion-client-id") || "")
    .trim()
    .slice(0, 160);
  const ip = requestIp(req);
  // The browser id is only a fallback for local/dev requests. In production the
  // stable IP-derived key prevents a caller from bypassing the upload cap simply
  // by rotating localStorage.
  const raw = ip ? `ip:${ip}` : `client:${rawClientId || "missing"}`;
  const secret = commerceSecret();
  if (!secret) {
    throw new Error("MOTION_EFFECTS_COMMERCE_SECRET 未配置");
  }
  return createHmac("sha256", secret).update(raw).digest("hex");
}

export async function getMotionEffectRequestIdentity(
  req: Request,
): Promise<MotionEffectRequestIdentity> {
  const session = await getServerSession();
  return {
    userId: session?.user?.id ? String(session.user.id) : null,
    ownerToken: String(req.headers.get("x-motion-owner-token") || "").trim(),
  };
}

export function ownerTokenMatches(row: any, token: string) {
  if (!row?.owner_token_hash || !token) return false;
  let actual = "";
  try {
    actual = hashMotionEffectOwnerToken(token);
  } catch {
    return false;
  }
  const expectedBuffer = Buffer.from(String(row.owner_token_hash));
  const actualBuffer = Buffer.from(actual);
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

export async function getAccessibleMotionEffectJob(
  jobId: string,
  identity: MotionEffectRequestIdentity,
) {
  const { data, error } = await db
    .from("tool_video_render_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (identity.userId && data.user_id === identity.userId) return data;
  if (ownerTokenMatches(data, identity.ownerToken)) return data;
  return null;
}

export async function releaseSignupFreeExport(jobId: string) {
  await db
    .from("tool_motion_effect_free_exports")
    .delete()
    .eq("job_id", jobId)
    .eq("status", "reserved");
}

export async function consumeSignupFreeExport(jobId: string) {
  await db
    .from("tool_motion_effect_free_exports")
    .update({
      status: "consumed",
      consumed_at: new Date().toISOString(),
    })
    .eq("job_id", jobId)
    .eq("status", "reserved");
}

export function calculateMotionEffectPrice(params: {
  quality: MotionEffectExportQuality;
  queueTier: MotionEffectQueueTier;
  signupFreeAvailable: boolean;
}) {
  const prices = getMotionEffectPrices();
  const freeStandardBase =
    params.signupFreeAvailable && params.quality === "standard";
  const baseCents = freeStandardBase
    ? 0
    : params.quality === "hd"
      ? prices.hdCents
      : prices.standardCents;
  const priorityCents =
    params.queueTier === "priority" ? prices.priorityAddonCents : 0;
  return {
    totalCents: baseCents + priorityCents,
    baseCents,
    priorityCents,
    usesSignupFree: freeStandardBase,
    prices,
  };
}

export const MAX_PAID_MOTION_RETRIES = 3;

/** 已付款但生成失败的任务可以用原视频重新排队，不再收费。 */
export function isPaidMotionRetry(row: { status?: string | null; payment_status?: string | null }) {
  return row.status === "failed" && row.payment_status === "paid";
}

export function paidMotionRetryCount(metadata: unknown) {
  const count = Number((metadata as { paid_retry_count?: unknown } | null)?.paid_retry_count);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

/** 只有还没发起过付款的任务能取消：一旦有订单，用户可能正在付款。 */
export function canCancelMotionJob(row: { status?: string | null; payment_status?: string | null; payment_order_id?: string | null }) {
  return ["awaiting_upload", "awaiting_payment"].includes(String(row.status))
    && row.payment_status !== "paid"
    && !row.payment_order_id;
}
