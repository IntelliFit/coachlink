import { NextResponse } from "next/server";
import { publishTask } from "@/lib/taskqueue/factory";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import {
  expireMotionEffectJobIfNeeded,
  getMotionEffectQueueConfig,
  mapMotionEffectJobWithQueueInfo,
} from "../../../_helpers";
import type { MotionEffectJobDto } from "../../../types";
import {
  getAccessibleMotionEffectJob,
  getMotionEffectRequestIdentity,
  isPaidMotionRetry,
  MAX_PAID_MOTION_RETRIES,
  normalizeQueueTier,
  paidMotionRetryCount,
} from "../../../_commerce";

export const runtime = "nodejs";
const db = serviceRoleSupabase as any;

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const identity = await getMotionEffectRequestIdentity(req);
  const { id } = await context.params;
  const job = await getAccessibleMotionEffectJob(id, identity);
  if (!job) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "任务不存在", data: null },
      { status: 404 },
    );
  }
  let current = await expireMotionEffectJobIfNeeded(job);
  // 已付款但生成失败：用原视频重新排队，不再收费
  const retryingPaidJob = isPaidMotionRetry(current);
  if (retryingPaidJob && paidMotionRetryCount(current.metadata) >= MAX_PAID_MOTION_RETRIES) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "这个任务已重试多次仍然失败，请联系客服处理退款", data: null },
      { status: 409 },
    );
  }
  if (!retryingPaidJob && !["awaiting_upload", "awaiting_payment"].includes(current.status)) {
    return NextResponse.json<ApiData<MotionEffectJobDto>>({
      success: true,
      message: "任务已入队",
      data: await mapMotionEffectJobWithQueueInfo(current),
    });
  }

  if (current.payment_order_id && current.payment_status !== "paid") {
    const { data: order } = await db
      .from("alipay_orders")
      .select("id,status,total_amount")
      .eq("id", current.payment_order_id)
      .maybeSingle();
    if (order?.status === "paid") {
      const { data } = await db
        .from("tool_video_render_jobs")
        .update({ payment_status: "paid", status: "awaiting_upload" })
        .eq("id", id)
        .eq("payment_order_id", order.id)
        .select("*")
        .maybeSingle();
      current = data || { ...current, payment_status: "paid", status: "awaiting_upload" };
    }
  }

  // 手指光膜全部免费：没付款的任务（含改免费前创建的）直接按免费生成
  const paid = current.payment_status === "paid";
  const queueTier = normalizeQueueTier(current.queue_tier);

  const info = await db.storage
    .from(current.input_storage_bucket || "videos")
    .info(current.input_storage_path);
  const expected = Number(current.original_file_size_bytes || 0);
  const actual = Number(info.data?.size ?? info.data?.metadata?.size ?? 0);
  if (info.error || expected <= 0 || actual <= 0 || Math.abs(expected - actual) > 1024) {
    return NextResponse.json<ApiData<null>>(
      {
        success: false,
        message: retryingPaidJob ? "原视频已不可用，无法重新生成，请联系客服处理退款" : "上传视频校验失败，请重新上传",
        data: null,
      },
      { status: 400 },
    );
  }

  const queue = getMotionEffectQueueConfig(queueTier);
  const metadata =
    current.metadata && typeof current.metadata === "object" ? current.metadata : {};
  const { data, error } = await db
    .from("tool_video_render_jobs")
    .update({
      status: "queued",
      ...(paid ? {} : { payment_status: "free" }),
      progress: 5,
      error_message: null,
      queue_driver: queue.driver,
      queue_topic: queue.topic,
      queue_consumer_group: queue.consumerGroup,
      enqueued_at: new Date().toISOString(),
      ...(retryingPaidJob ? { completed_at: null } : {}),
      metadata: {
        ...metadata,
        ...(retryingPaidJob ? { paid_retry_count: paidMotionRetryCount(metadata) + 1 } : {}),
        storage_verified_at: new Date().toISOString(),
        storage_verified_size_bytes: actual,
        paid_or_free_verified_at: new Date().toISOString(),
      },
    })
    .eq("id", id)
    .in("status", retryingPaidJob ? ["failed"] : ["awaiting_upload", "awaiting_payment"])
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
