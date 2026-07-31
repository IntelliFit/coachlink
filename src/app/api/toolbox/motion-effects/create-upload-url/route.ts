import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import presets from "../../../../../../config/motion-effects-presets.json";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import {
  MOTION_EFFECTS_BUCKET,
  buildMotionEffectInputPath,
  buildMotionEffectOutputPath,
  failStaleMotionEffectJobsForUser,
  getMotionEffectLimits,
  getMotionEffectQueueConfig,
  isSupportedVideoContentType,
  mapMotionEffectJob,
} from "../_helpers";
import type {
  CreateMotionEffectUploadDto,
  CreateMotionEffectUploadResponseDto,
} from "../types";
import {
  createMotionEffectClientKey,
  createMotionEffectOwnerToken,
  getMotionEffectPrices,
  getMotionEffectRequestIdentity,
  hasSignupFreeExport,
  hashMotionEffectOwnerToken,
  normalizeExportQuality,
  normalizeQueueTier,
} from "../_commerce";

export const runtime = "nodejs";
export const maxDuration = 60;
const db = serviceRoleSupabase as any;
const MOTION_EFFECT_STYLE_KEYS = new Set([
  "aurora",
  "cyber",
  "lava",
  "candy",
  "ice",
  "galaxy",
  "emerald",
  "gold",
]);

function option<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export async function POST(req: Request) {
  const identity = await getMotionEffectRequestIdentity(req);

  let body: CreateMotionEffectUploadDto;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "请求参数错误", data: null },
      { status: 400 },
    );
  }

  const originalFilename = String(body.originalFilename || "").trim();
  const contentType = String(body.contentType || "").trim();
  const fileSizeBytes = Number(body.fileSizeBytes || 0);
  const durationSeconds = Number(body.durationSeconds || 0);
  const styleKey = MOTION_EFFECT_STYLE_KEYS.has(String(body.styleKey || ""))
    ? String(body.styleKey)
    : "aurora";
  const motionSpeed = option(
    body.motionSpeed,
    ["gentle", "balanced", "energetic"] as const,
    "balanced",
  );
  const glowStrength = option(
    body.glowStrength,
    ["soft", "balanced", "strong"] as const,
    "balanced",
  );
  const surfaceDensity = option(
    body.surfaceDensity,
    ["transparent", "balanced", "rich"] as const,
    "balanced",
  );
  const limits = getMotionEffectLimits();

  if (!originalFilename || !isSupportedVideoContentType(contentType)) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "请上传有效的视频文件", data: null },
      { status: 400 },
    );
  }
  if (
    !Number.isFinite(fileSizeBytes) ||
    fileSizeBytes <= 0 ||
    fileSizeBytes > limits.maxVideoSizeMb * 1024 * 1024
  ) {
    return NextResponse.json<ApiData<null>>(
      {
        success: false,
        message: `视频过大或无效，最多支持 ${limits.maxVideoSizeMb}MB`,
        data: null,
      },
      { status: 413 },
    );
  }
  if (
    Number.isFinite(durationSeconds) &&
    durationSeconds > limits.maxDurationSeconds
  ) {
    return NextResponse.json<ApiData<null>>(
      {
        success: false,
        message: `当前最多支持 ${limits.maxDurationSeconds} 秒视频`,
        data: null,
      },
      { status: 413 },
    );
  }

  const userId = identity.userId;
  const clientKeyHash = createMotionEffectClientKey(req);
  const ownerToken = userId ? "" : createMotionEffectOwnerToken();
  const ownerTokenHash = ownerToken ? hashMotionEffectOwnerToken(ownerToken) : null;
  if (userId) {
    await failStaleMotionEffectJobsForUser(userId);
  } else {
    const staleBefore = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await db
      .from("tool_video_render_jobs")
      .update({
        status: "failed",
        progress: 100,
        error_message: "任务长时间没有进展，已自动释放名额",
        completed_at: new Date().toISOString(),
      })
      .eq("client_key_hash", clientKeyHash)
      .in("status", ["awaiting_upload", "awaiting_payment", "queued", "processing"])
      .lt("updated_at", staleBefore);
  }
  let activeQuery = db
    .from("tool_video_render_jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["awaiting_upload", "awaiting_payment", "queued", "processing"])
    .gt("expires_at", new Date().toISOString());
  activeQuery = userId
    ? activeQuery.eq("user_id", userId)
    : activeQuery.eq("client_key_hash", clientKeyHash).is("user_id", null);
  const { count: activeCount } = await activeQuery;
  if ((activeCount || 0) >= 1) {
    return NextResponse.json<ApiData<null>>(
      {
        success: false,
        message: "当前设备已有一个视频正在生成或等待付款，请先完成该任务",
        data: null,
      },
      { status: 409 },
    );
  }

  if (!userId) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: guestCreateCount } = await db
      .from("tool_video_render_jobs")
      .select("id", { count: "exact", head: true })
      .eq("client_key_hash", clientKeyHash)
      .is("user_id", null)
      .gte("created_at", since);
    if ((guestCreateCount || 0) >= 3) {
      return NextResponse.json<ApiData<null>>(
        {
          success: false,
          message: "当前设备今天创建的未注册任务过多，请登录后继续",
          data: null,
        },
        { status: 429 },
      );
    }
  }

  const jobId = randomUUID();
  const exportQuality = normalizeExportQuality(body.exportQuality);
  const queueTier = normalizeQueueTier(body.queueTier);
  const allowedStyles = new Set(presets.styles.map((style) => style.key));
  const styleKey = allowedStyles.has(String(body.styleKey || ""))
    ? String(body.styleKey)
    : "aurora";
  const bgmKey = body.bgmKey === "original" ? "original" : "original";
  const queue = getMotionEffectQueueConfig(queueTier);
  const storageOwner = userId || `guest-${clientKeyHash.slice(0, 18)}`;
  const inputPath = buildMotionEffectInputPath({
    userId: storageOwner,
    jobId,
    filename: originalFilename,
  });
  const outputPath = buildMotionEffectOutputPath({ userId: storageOwner, jobId });
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: signed, error: signedError } = await db.storage
    .from(MOTION_EFFECTS_BUCKET)
    .createSignedUploadUrl(inputPath, { upsert: false });
  if (signedError || !signed?.token) {
    console.error("[motion-effects/create-upload-url] signed upload failed:", signedError);
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "创建上传链接失败", data: null },
      { status: 500 },
    );
  }

  const supabaseUrl = String(
    process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL || "",
  ).replace(/\/+$/, "");
  const encodedPath = inputPath.split("/").map(encodeURIComponent).join("/");
  const uploadUrl = supabaseUrl
    ? `${supabaseUrl}/storage/v1/object/upload/sign/${MOTION_EFFECTS_BUCKET}/${encodedPath}?token=${encodeURIComponent(signed.token)}`
    : "";

  const { data: job, error } = await db
    .from("tool_video_render_jobs")
    .insert({
      id: jobId,
      user_id: userId,
      owner_token_hash: ownerTokenHash,
      client_key_hash: clientKeyHash,
      effect_type: "finger_membrane",
      effect_version: "v5",
      status: "awaiting_upload",
      progress: 0,
      input_storage_bucket: MOTION_EFFECTS_BUCKET,
      input_storage_path: inputPath,
      output_storage_bucket: MOTION_EFFECTS_BUCKET,
      output_storage_path: outputPath,
      original_filename: originalFilename,
      original_file_size_bytes: Math.round(fileSizeBytes),
      queue_driver: queue.driver,
      queue_topic: queue.topic,
      queue_consumer_group: queue.consumerGroup,
      export_quality: exportQuality,
      queue_tier: queueTier,
      style_key: styleKey,
      bgm_key: bgmKey,
      payment_status: "unpaid",
      price_cents: 0,
      metadata: {
        content_type: contentType,
        duration_seconds: durationSeconds > 0 ? durationSeconds : null,
        retention_hours: 24,
        watermark: "教链",
        topology: "same_finger_dynamic_closed_prism",
        export_quality: exportQuality,
        queue_tier: queueTier,
        style_key: styleKey,
        bgm_key: bgmKey,
        motion_speed: motionSpeed,
        glow_strength: glowStrength,
        surface_density: surfaceDensity,
        resource_notice:
          "视频导出会占用服务器计算、临时存储和下载带宽；预览免费，下载按所选规格计费。",
      },
      expires_at: expiresAt,
    })
    .select("*")
    .single();
  if (error || !job) {
    console.error("[motion-effects/create-upload-url] insert failed:", error);
    return NextResponse.json<ApiData<null>>(
      { success: false, message: error?.message || "创建任务失败", data: null },
      { status: 500 },
    );
  }

  return NextResponse.json<ApiData<CreateMotionEffectUploadResponseDto>>({
    success: true,
    message: "创建上传任务成功",
    data: {
      job: mapMotionEffectJob(job),
      upload: {
        bucket: MOTION_EFFECTS_BUCKET,
        path: inputPath,
        uploadUrl,
        token: signed.token,
        expiresAt,
      },
      limits,
      ownerToken: ownerToken || undefined,
      signedIn: Boolean(userId),
      signupFreeAvailable: userId ? await hasSignupFreeExport(userId) : false,
      prices: getMotionEffectPrices(),
    },
  });
}
