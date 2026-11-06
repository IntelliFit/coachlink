import { NextResponse } from "next/server";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import {
  canCancelMotionJob,
  getAccessibleMotionEffectJob,
  getMotionEffectRequestIdentity,
} from "../../../_commerce";
import { mapMotionEffectJob, MOTION_EFFECTS_BUCKET } from "../../../_helpers";
import type { MotionEffectJobDto } from "../../../types";

export const runtime = "nodejs";
const db = serviceRoleSupabase as any;

/**
 * 取消还没发起过付款的任务（上传失败、用户换视频），释放「同时只能有一个任务」的名额。
 * 已有订单的任务不能取消：用户可能正在付款，这种任务由超时释放。
 */
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
  if (!["awaiting_upload", "awaiting_payment"].includes(job.status)) {
    return NextResponse.json<ApiData<MotionEffectJobDto>>({
      success: true,
      message: "任务已结束",
      data: mapMotionEffectJob(job),
    });
  }
  if (!canCancelMotionJob(job)) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "这个任务已发起付款，不能取消；未付款的话最多 1 小时后自动释放", data: null },
      { status: 409 },
    );
  }

  const { data, error } = await db
    .from("tool_video_render_jobs")
    .update({
      status: "failed",
      progress: 100,
      error_message: "已取消",
      completed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", ["awaiting_upload", "awaiting_payment"])
    .is("payment_order_id", null)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[motion-effects/cancel] update failed:", error);
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "取消失败，请稍后再试", data: null },
      { status: 500 },
    );
  }
  if (!data) {
    // 读取之后任务状态变了（比如刚好入队），把最新状态告诉客户端，由它接着跟进
    const latest = await getAccessibleMotionEffectJob(id, identity);
    if (!latest) {
      return NextResponse.json<ApiData<null>>(
        { success: false, message: "任务不存在", data: null },
        { status: 404 },
      );
    }
    return NextResponse.json<ApiData<MotionEffectJobDto>>({
      success: true,
      message: "任务状态已变化，未取消",
      data: mapMotionEffectJob(latest),
    });
  }
  if (job.input_storage_path) {
    await db.storage
      .from(job.input_storage_bucket || MOTION_EFFECTS_BUCKET)
      .remove([job.input_storage_path])
      .catch(() => null);
  }
  return NextResponse.json<ApiData<MotionEffectJobDto>>({
    success: true,
    message: "任务已取消",
    data: mapMotionEffectJob(data),
  });
}
