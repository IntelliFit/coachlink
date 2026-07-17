import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { publishTask } from "@/lib/taskqueue/factory";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { getTaskQueueConfig } from "@/lib/taskqueue/config";
import type { ApiData } from "@/types/api";
import type { PowerAnalysisJobDto } from "../../../types";
import {
  expirePowerAnalysisJobIfNeeded,
  getOwnedPowerAnalysisJob,
  mapPowerAnalysisJobWithQueueInfo,
} from "../../../_helpers";

export const runtime = "nodejs";

const db = serviceRoleSupabase as any;

function normalizeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function POST(
  _req: Request,
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
    return NextResponse.json<ApiData<PowerAnalysisJobDto>>({
      success: true,
      message: "任务已入队",
      data: await mapPowerAnalysisJobWithQueueInfo(current),
    });
  }

  const inputBucket = String(current.input_storage_bucket || "videos");
  const inputPath = String(current.input_storage_path || "");
  const expectedSize = Number(current.original_file_size_bytes || 0);
  const { data: storedObject, error: infoError } = inputPath
    ? await db.storage.from(inputBucket).info(inputPath)
    : { data: null, error: new Error("missing_input_path") };
  const storedSize = Number(storedObject?.size ?? storedObject?.metadata?.size ?? -1);
  const sizeMatches = expectedSize > 0 && storedSize > 0 && Math.abs(storedSize - expectedSize) <= 1024;

  if (infoError || !sizeMatches) {
    const message = storedSize <= 0
      ? "上传视频不存在或内容为空，请重新选择视频"
      : "上传视频大小校验失败，请重新上传";
    const metadata = normalizeMetadata(current.metadata);
    await db
      .from("tool_power_analysis_jobs")
      .update({
        metadata: {
          ...metadata,
          upload_failure_stage: "pre_enqueue_storage_verification",
          upload_failure_message: message,
          storage_verified_size_bytes: storedSize > 0 ? storedSize : null,
          upload_failed_at: new Date().toISOString(),
        },
        error_message: message,
      })
      .eq("id", id)
      .eq("user_id", session.user.id)
      .eq("status", "awaiting_upload");
    return NextResponse.json<ApiData<null>>(
      { success: false, message, data: null },
      { status: 400 },
    );
  }

  const queueConfig = getTaskQueueConfig(process.env, { requireTopic: true });
  const metadata = normalizeMetadata(current.metadata);
  const { data, error } = await db
    .from("tool_power_analysis_jobs")
    .update({
      status: "queued",
      progress: 5,
      error_message: null,
      queue_driver: queueConfig.driver,
      queue_topic: queueConfig.topic,
      queue_consumer_group: queueConfig.consumerGroup,
      enqueued_at: new Date().toISOString(),
      metadata: {
        ...metadata,
        storage_verified_at: new Date().toISOString(),
        storage_verified_size_bytes: storedSize,
        upload_failure_stage: null,
        upload_failure_message: null,
      },
    })
    .eq("id", id)
    .eq("user_id", session.user.id)
    .eq("status", "awaiting_upload")
    .select("*")
    .single();

  if (error || !data) {
    console.error("[power-analysis/enqueue] failed:", error);
    return NextResponse.json<ApiData<null>>(
      { success: false, message: error?.message || "任务入队失败", data: null },
      { status: 500 },
    );
  }

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.POWER_ANALYSIS_SKIP_QUEUE_PUBLISH === "1"
  ) {
    return NextResponse.json<ApiData<PowerAnalysisJobDto>>({
      success: true,
      message: "任务已入队",
      data: await mapPowerAnalysisJobWithQueueInfo(data),
    });
  }

  try {
    await publishTask({ taskId: data.id, taskType: "power_analysis" });
  } catch (queueError) {
    console.error("[power-analysis/enqueue] publish failed:", queueError);
    await db
      .from("tool_power_analysis_jobs")
      .update({
        status: "failed",
        progress: 100,
        error_message: "任务入队失败，请稍后重试",
        completed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "queued");
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "任务入队失败，请稍后重试", data: null },
      { status: 503 },
    );
  }

  return NextResponse.json<ApiData<PowerAnalysisJobDto>>({
    success: true,
    message: "任务已入队",
    data: await mapPowerAnalysisJobWithQueueInfo(data),
  });
}
