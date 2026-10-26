import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getPowerAnalysisCancelDecision } from "@coachlink/core/src/powerAnalysisJobs";
import type { ApiData } from "@/types/api";
import type { PowerAnalysisJobDto } from "../../../types";
import {
  cancelPowerAnalysisJob,
  getOwnedPowerAnalysisJob,
  mapPowerAnalysisJob,
} from "../../../_helpers";

export const runtime = "nodejs";

/** Cancels the caller's own job while it waits for upload, is queued or is being analyzed. */
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
  try {
    const job = await getOwnedPowerAnalysisJob(id, session.user.id);
    if (!job) {
      return NextResponse.json<ApiData<null>>(
        { success: false, message: "任务不存在", data: null },
        { status: 404 },
      );
    }

    const decision = getPowerAnalysisCancelDecision(job.status);
    if (decision.action === "already_canceled") {
      return NextResponse.json<ApiData<PowerAnalysisJobDto>>({
        success: true,
        message: "任务已取消",
        data: mapPowerAnalysisJob(job),
      });
    }
    if (decision.action === "reject") {
      return NextResponse.json<ApiData<null>>(
        { success: false, message: decision.message, data: null },
        { status: 409 },
      );
    }

    const canceled = await cancelPowerAnalysisJob(job);
    if (!canceled) {
      // The status changed between the read and the update (usually: the analysis just finished).
      const latest = await getOwnedPowerAnalysisJob(id, session.user.id);
      const next = getPowerAnalysisCancelDecision(latest?.status);
      return NextResponse.json<ApiData<null>>(
        {
          success: false,
          message: next.action === "reject" ? next.message : "任务状态已变化，请刷新后重试",
          data: null,
        },
        { status: 409 },
      );
    }

    return NextResponse.json<ApiData<PowerAnalysisJobDto>>({
      success: true,
      message: "任务已取消",
      data: mapPowerAnalysisJob(canceled),
    });
  } catch (error: any) {
    console.error("[power-analysis/jobs/cancel] failed:", id, error);
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "取消失败，请稍后重试", data: null },
      { status: 500 },
    );
  }
}
