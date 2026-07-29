import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { publishTask } from "@/lib/taskqueue/factory";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import {
  expireMotionEffectJobIfNeeded,
  getMotionEffectQueueConfig,
  getOwnedMotionEffectJob,
  mapMotionEffectJobWithQueueInfo,
} from "../../../_helpers";
import type { MotionEffectJobDto } from "../../../types";

export const runtime = "nodejs";
const db = serviceRoleSupabase as any;

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
  const job = await getOwnedMotionEffectJob(id, session.user.id);
  if (!job) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "任务不存在", data: null },
      { status: 404 },
    );
  }
  const current = await expireMotionEffectJobIfNeeded(job);
  if (current.status !== "awaiting_upload") {
    return NextResponse.json<ApiData<MotionEffectJobDto>>({
      success: true,
      message: "任务已入队",
      data: await mapMotionEffectJobWithQueueInfo(current),
    });
  }

  const info = await db.storage
    .from(current.input_storage_bucket || "videos")
    .info(current.input_storage_path);
  const expected = Number(current.original_file_size_bytes || 0);
  const actual = Number(info.data?.size ?? info.data?.metadata?.size ?? 0);
  if (info.error || expected <= 0 || actual <= 0 || Math.abs(expected - actual) > 1024) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "上传视频校验失败，请重新上传", data: null },
      { status: 400 },
    );
  }

  const queue = getMotionEffectQueueConfig();
  const metadata =
    current.metadata && typeof current.metadata === "object" ? current.metadata : {};
  const { data, error } = await db
    .from("tool_video_render_jobs")
    .update({
      status: "queued",
      progress: 5,
      error_message: null,
      queue_driver: queue.driver,
      queue_topic: queue.topic,
      queue_consumer_group: queue.consumerGroup,
      enqueued_at: new Date().toISOString(),
      metadata: {
        ...metadata,
        storage_verified_at: new Date().toISOString(),
        storage_verified_size_bytes: actual,
      },
    })
    .eq("id", id)
    .eq("user_id", session.user.id)
    .eq("status", "awaiting_upload")
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: error?.message || "任务入队失败", data: null },
      { status: 500 },
    );
  }

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.MOTION_EFFECTS_SKIP_QUEUE_PUBLISH === "1"
  ) {
    return NextResponse.json<ApiData<MotionEffectJobDto>>({
      success: true,
      message: "任务已入队",
      data: await mapMotionEffectJobWithQueueInfo(data),
    });
  }

  try {
    await publishTask(
      { taskId: data.id, taskType: "motion_effects" },
      queue,
    );
  } catch (queueError) {
    console.error("[motion-effects/enqueue] publish failed:", queueError);
    await db
      .from("tool_video_render_jobs")
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

  return NextResponse.json<ApiData<MotionEffectJobDto>>({
    success: true,
    message: "任务已入队",
    data: await mapMotionEffectJobWithQueueInfo(data),
  });
}
