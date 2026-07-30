import { NextResponse } from "next/server";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import {
  getAccessibleMotionEffectJob,
  getMotionEffectRequestIdentity,
} from "../../../_commerce";
import { mapMotionEffectJob } from "../../../_helpers";
import type { MotionEffectJobDto } from "../../../types";

export const runtime = "nodejs";
const db = serviceRoleSupabase as any;

export async function GET(
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
  if (!job.payment_order_id) {
    return NextResponse.json<ApiData<MotionEffectJobDto>>({
      success: true,
      message: job.payment_status === "free" ? "注册赠送权益已生效" : "尚未创建支付订单",
      data: mapMotionEffectJob(job),
    });
  }

  const { data: order, error } = await db
    .from("alipay_orders")
    .select("id,status,total_amount")
    .eq("id", job.payment_order_id)
    .maybeSingle();
  if (error || !order) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "支付订单不存在", data: null },
      { status: 404 },
    );
  }
  let current = job;
  if (order.status === "paid" && job.payment_status !== "paid") {
    const { data } = await db
      .from("tool_video_render_jobs")
      .update({
        payment_status: "paid",
        status: job.status === "awaiting_payment" ? "awaiting_upload" : job.status,
      })
      .eq("id", id)
      .eq("payment_order_id", order.id)
      .select("*")
      .maybeSingle();
    current = data || {
      ...job,
      payment_status: "paid",
      status: job.status === "awaiting_payment" ? "awaiting_upload" : job.status,
    };
  }
  return NextResponse.json<ApiData<MotionEffectJobDto>>({
    success: true,
    message: order.status === "paid" ? "支付成功" : "等待支付",
    data: mapMotionEffectJob(current),
  });
}
