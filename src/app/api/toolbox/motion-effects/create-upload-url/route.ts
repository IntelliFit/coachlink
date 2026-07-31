import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
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
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "请先登录后再生成特效视频", data: null },
      { status: 401 },
    );
  }

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

  const userId = session.user.id;
  await failStaleMotionEffectJobsForUser(userId);
  const { count: activeCount } = await db
    .from("tool_video_render_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["queued", "processing"])
    .gt("expires_at", new Date().toISOString());
  if ((activeCount || 0) >= 1) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "你已有一个特效视频正在生成，请稍后再试", data: null },
      { status: 409 },
    );
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: dailyCount } = await db
    .from("tool_video_render_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("effect_type", "finger_membrane")
    .in("status", ["queued", "processing", "done"])
    .gte("created_at", since);
  if ((dailyCount || 0) >= limits.dailyLimit) {
    return NextResponse.json<ApiData<null>>(
      {
        success: false,
        message: `今天已经生成 ${limits.dailyLimit} 次了，明天再来`,
        data: null,
      },
      { status: 429 },
    );
  }

  const jobId = randomUUID();
  const queue = getMotionEffectQueueConfig();
  const inputPath = buildMotionEffectInputPath({ userId, jobId, filename: originalFilename });
  const outputPath = buildMotionEffectOutputPath({ userId, jobId });
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
      style_key: styleKey,
      metadata: {
        content_type: contentType,
        duration_seconds: durationSeconds > 0 ? durationSeconds : null,
        retention_hours: 24,
        watermark: "教链",
        topology: "same_finger_dynamic_closed_prism",
        style_key: styleKey,
        motion_speed: motionSpeed,
        glow_strength: glowStrength,
        surface_density: surfaceDensity,
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
    },
  });
}
