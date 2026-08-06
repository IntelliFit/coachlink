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
  calculateMotionEffectPrice,
  getAccessibleMotionEffectJob,
  getMotionEffectRequestIdentity,
  hasSignupFreeExport,
  normalizeExportQuality,
  normalizeQueueTier,
  releaseSignupFreeExport,
  reserveSignupFreeExport,
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
  if (!["awaiting_upload", "awaiting_payment"].includes(current.status)) {
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

  const quality = normalizeExportQuality(current.export_quality);
  const queueTier = normalizeQueueTier(current.queue_tier);
  const signupFreeAvailable = identity.userId
    ? await hasSignupFreeExport(identity.userId)
    : false;
  const quote = calculateMotionEffectPrice({
    quality,
    queueTier,
    signupFreeAvailable,
  });
  let reservedSignupFree = false;
  const paid = current.payment_status === "paid";
  if (paid && current.entitlement_source === "signup_free") {
    if (!identity.userId) {
      return NextResponse.json<ApiData<null>>(
        { success: false, message: "注册赠送权益必须由登录账号使用", data: null },
        { status: 403 },
      );
    }
    reservedSignupFree = await reserveSignupFreeExport(identity.userId, id);
    if (!reservedSignupFree) {
      // The payment already granted this job a discounted base export. Do not
      // strand a paid customer if another browser tab won the free-entitlement
      // reservation race; continue this paid job and keep the first reservation
      // as the durable lifetime-use record.
      console.warn("[motion-effects/enqueue] signup free reservation raced", {
        userId: identity.userId,
        jobId: id,
      });
    }
  } else if (
    !paid &&
    identity.userId &&
    quality === "standard" &&
    queueTier === "standard" &&
    quote.totalCents === 0
  ) {
    reservedSignupFree = await reserveSignupFreeExport(identity.userId, id);
    if (reservedSignupFree) {
      const { data } = await db
        .from("tool_video_render_jobs")
        .update({
          payment_status: "free",
          entitlement_source: "signup_free",
          price_cents: 0,
        })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      current = data || {
        ...current,
        payment_status: "free",
        entitlement_source: "signup_free",
        price_cents: 0,
      };
    }
  }

  if (!paid && !reservedSignupFree) {
    return NextResponse.json(
      {
        success: false,
        message: identity.userId
          ? quality === "hd"
            ? "高清下载需要付费"
            : queueTier === "priority"
              ? "极速处理需要付费"
              : "注册赠送的免费下载已使用，本次下载需要付费"
          : "未注册用户下载视频需要付费；注册可获一次低清免费下载",
        data: {
          paymentRequired: true,
          quote,
          signedIn: Boolean(identity.userId),
        },
      },
      { status: 402 },
    );
  }

  const info = await db.storage
    .from(current.input_storage_bucket || "videos")
    .info(current.input_storage_path);
  const expected = Number(current.original_file_size_bytes || 0);
  const actual = Number(info.data?.size ?? info.data?.metadata?.size ?? 0);
  if (info.error || expected <= 0 || actual <= 0 || Math.abs(expected - actual) > 1024) {
    if (reservedSignupFree) await releaseSignupFreeExport(id);
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "上传视频校验失败，请重新上传", data: null },
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
        paid_or_free_verified_at: new Date().toISOString(),
      },
    })
    .eq("id", id)
    .in("status", ["awaiting_upload", "awaiting_payment"])
    .select("*")
    .single();
  if (error || !data) {
    if (reservedSignupFree) await releaseSignupFreeExport(id);
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
    if (reservedSignupFree) await releaseSignupFreeExport(id);
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
