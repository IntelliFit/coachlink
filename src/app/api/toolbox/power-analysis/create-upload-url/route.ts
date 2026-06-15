import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { getTaskQueueConfig } from "@/lib/taskqueue/config";
import type { ApiData } from "@/types/api";
import type {
  CreatePowerAnalysisUploadUrlDto,
  CreatePowerAnalysisUploadUrlResponseDto,
} from "../types";
import {
  POWER_ANALYSIS_BUCKET,
  buildPowerAnalysisOutputPath,
  buildPowerAnalysisPath,
  getPowerAnalysisLimits,
  isSupportedVideoContentType,
  mapPowerAnalysisJob,
  normalizeMode,
  numberInRange,
} from "../_helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

const db = serviceRoleSupabase as any;

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "请先登录后再使用视频分析工具", data: null },
      { status: 401 },
    );
  }

  const userId = session.user.id;
  const limits = getPowerAnalysisLimits();

  let body: CreatePowerAnalysisUploadUrlDto;
  try {
    body = (await req.json()) as CreatePowerAnalysisUploadUrlDto;
  } catch {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "请求参数错误", data: null },
      { status: 400 },
    );
  }

  const mode = normalizeMode(body?.mode);
  const heightCm = numberInRange(body?.heightCm, 100, 250);
  const weightKg = numberInRange(body?.weightKg, 30, 250);
  const originalFilename = String(body?.originalFilename || "").trim();
  const contentType = String(body?.contentType || "").trim();
  const fileSizeBytes = Number(body?.fileSizeBytes || 0);

  if (!mode || heightCm === null || weightKg === null) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "请填写有效的动作类型、身高和体重", data: null },
      { status: 400 },
    );
  }

  if (!originalFilename || !isSupportedVideoContentType(contentType)) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "请上传视频文件", data: null },
      { status: 400 },
    );
  }

  const maxSizeBytes = limits.maxVideoSizeMb * 1024 * 1024;
  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0 || fileSizeBytes > maxSizeBytes) {
    return NextResponse.json<ApiData<null>>(
      {
        success: false,
        message: `视频过大或无效，当前最多支持 ${limits.maxVideoSizeMb}MB`,
        data: null,
      },
      { status: 413 },
    );
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count: activeCount } = await db
    .from("tool_power_analysis_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["queued", "processing"])
    .gt("expires_at", new Date().toISOString());

  if ((activeCount || 0) >= 1) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "你已有一个视频正在上传或分析，请完成后再提交新任务", data: null },
      { status: 409 },
    );
  }

  const { count: dailyCount } = await db
    .from("tool_power_analysis_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if ((dailyCount || 0) >= limits.dailyLimit) {
    return NextResponse.json<ApiData<null>>(
      {
        success: false,
        message: `今天已经分析 ${limits.dailyLimit} 次了，明天再来测一次`,
        data: null,
      },
      { status: 429 },
    );
  }

  const jobId = randomUUID();
  const queueConfig = getTaskQueueConfig(process.env, { requireTopic: true });
  const inputPath = buildPowerAnalysisPath({ userId, jobId, filename: originalFilename });
  const outputPath = buildPowerAnalysisOutputPath({ userId, jobId });
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: signed, error: signedError } = await db.storage
    .from(POWER_ANALYSIS_BUCKET)
    .createSignedUploadUrl(inputPath, { upsert: false });

  if (signedError || !signed?.token) {
    console.error("[power-analysis/create-upload-url] signed upload failed:", signedError);
    return NextResponse.json<ApiData<null>>(
      { success: false, message: signedError?.message || "创建上传链接失败", data: null },
      { status: 500 },
    );
  }

  const supabaseUrl = (process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const encodedPath = inputPath.split("/").map((seg) => encodeURIComponent(seg)).join("/");
  const uploadUrl = supabaseUrl
    ? `${supabaseUrl}/storage/v1/object/upload/sign/${POWER_ANALYSIS_BUCKET}/${encodedPath}?token=${encodeURIComponent(signed.token)}`
    : "";

  const { data: job, error: insertError } = await db
    .from("tool_power_analysis_jobs")
    .insert({
      id: jobId,
      user_id: userId,
      mode,
      height_cm: heightCm,
      weight_kg: weightKg,
      status: "awaiting_upload",
      progress: 0,
      input_storage_bucket: POWER_ANALYSIS_BUCKET,
      input_storage_path: inputPath,
      output_storage_bucket: POWER_ANALYSIS_BUCKET,
      output_storage_path: outputPath,
      queue_driver: queueConfig.driver,
      queue_topic: queueConfig.topic,
      queue_consumer_group: queueConfig.consumerGroup,
      original_filename: originalFilename,
      original_file_size_bytes: Math.round(fileSizeBytes),
      metadata: {
        content_type: contentType,
        upload_strategy: "signed_upload_transient",
        retention_hours: 24,
      },
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (insertError || !job) {
    console.error("[power-analysis/create-upload-url] insert job failed:", insertError);
    return NextResponse.json<ApiData<null>>(
      { success: false, message: insertError?.message || "创建任务失败", data: null },
      { status: 500 },
    );
  }

  return NextResponse.json<ApiData<CreatePowerAnalysisUploadUrlResponseDto>>({
    success: true,
    message: "创建上传任务成功",
    data: {
      job: mapPowerAnalysisJob(job),
      upload: {
        bucket: POWER_ANALYSIS_BUCKET,
        path: inputPath,
        uploadUrl,
        token: signed.token,
        expiresAt,
      },
      limits,
    },
  });
}
