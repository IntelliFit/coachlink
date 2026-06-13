import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { publishTask } from "@/lib/taskqueue/factory";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { PowerAnalysisJobDto } from "../../../types";
import {
  expirePowerAnalysisJobIfNeeded,
  getOwnedPowerAnalysisJob,
  mapPowerAnalysisJob,
} from "../../../_helpers";

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
      data: mapPowerAnalysisJob(current),
    });
  }

  const { data, error } = await db
    .from("tool_power_analysis_jobs")
    .update({
      status: "queued",
      progress: 5,
      error_message: null,
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
    data: mapPowerAnalysisJob(data),
  });
}
