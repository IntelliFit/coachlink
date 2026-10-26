import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type { ApiData } from "@/types/api";
import type { PowerAnalysisJobDto } from "../../types";
import {
  getActivePowerAnalysisJobForUser,
  mapPowerAnalysisJobWithQueueInfo,
} from "../../_helpers";

export const runtime = "nodejs";

/** The caller's queued or processing job, so a page opened later can show its progress. */
export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "用户未登录", data: null },
      { status: 401 },
    );
  }

  try {
    const row = await getActivePowerAnalysisJobForUser(session.user.id);
    return NextResponse.json<ApiData<{ job: PowerAnalysisJobDto | null }>>({
      success: true,
      data: { job: row ? await mapPowerAnalysisJobWithQueueInfo(row) : null },
    });
  } catch (error: any) {
    console.error("[power-analysis/jobs/active] lookup failed:", error);
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "查询进行中的任务失败，请稍后重试", data: null },
      { status: 500 },
    );
  }
}
