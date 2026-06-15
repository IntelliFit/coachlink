import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { PowerAnalysisJobDto } from "../../../types";
import {
  POWER_ANALYSIS_BUCKET,
  expirePowerAnalysisJobIfNeeded,
  getOwnedPowerAnalysisJob,
  getPowerAnalysisLimits,
  isSupportedVideoContentType,
  mapPowerAnalysisJob,
} from "../../../_helpers";

export const runtime = "nodejs";
export const maxDuration = 300;
export const preferredRegion = "auto";

const db = serviceRoleSupabase as any;

function normalizeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "用户未登录", data: null },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const job = await getOwnedPowerAnalysisJob(id, session.user.id);
  if (!job) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "任务不存在", data: null },
      { status: 404 },
    );
  }

  const current = await expirePowerAnalysisJobIfNeeded(job);
  if (current.status === "expired") {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "任务已过期，请重新上传", data: null },
      { status: 410 },
    );
  }

  if (current.status !== "awaiting_upload") {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "任务状态已变化，请重新提交", data: null },
      { status: 409 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const contentType = String(
    formData.get("contentType") ||
      file?.type ||
      normalizeMetadata(current.metadata).content_type ||
      "",
  ).trim();

  if (!file || !isSupportedVideoContentType(contentType)) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "请上传视频文件", data: null },
      { status: 400 },
    );
  }

  const limits = getPowerAnalysisLimits();
  const maxSizeBytes = limits.maxVideoSizeMb * 1024 * 1024;
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > maxSizeBytes) {
    return NextResponse.json<ApiData<null>>(
      {
        success: false,
        message: `视频过大或无效，当前最多支持 ${limits.maxVideoSizeMb}MB`,
        data: null,
      },
      { status: 413 },
    );
  }

  const inputPath = String(current.input_storage_path || "");
  if (!inputPath) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "任务缺少上传路径", data: null },
      { status: 500 },
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await db.storage
    .from(POWER_ANALYSIS_BUCKET)
    .upload(inputPath, buffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    console.error("[power-analysis/upload] upload failed:", uploadError);
    return NextResponse.json<ApiData<null>>(
      { success: false, message: uploadError.message || "上传失败", data: null },
      { status: 500 },
    );
  }

  const metadata = {
    ...normalizeMetadata(current.metadata),
    content_type: contentType,
    upload_strategy: "miniapp_server_multipart_proxy",
    uploaded_at: new Date().toISOString(),
  };

  const { data, error: updateError } = await db
    .from("tool_power_analysis_jobs")
    .update({
      metadata,
      original_file_size_bytes: Math.round(file.size),
      error_message: null,
    })
    .eq("id", id)
    .eq("user_id", session.user.id)
    .eq("status", "awaiting_upload")
    .select("*")
    .single();

  if (updateError || !data) {
    console.error("[power-analysis/upload] metadata update failed:", updateError);
    return NextResponse.json<ApiData<null>>(
      { success: false, message: updateError?.message || "上传记录更新失败", data: null },
      { status: 500 },
    );
  }

  return NextResponse.json<ApiData<PowerAnalysisJobDto>>({
    success: true,
    message: "上传成功",
    data: mapPowerAnalysisJob(data),
  });
}

