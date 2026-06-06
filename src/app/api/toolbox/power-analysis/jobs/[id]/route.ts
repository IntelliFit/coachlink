import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type { ApiData } from "@/types/api";
import type { PowerAnalysisJobDto } from "../../types";
import {
  expirePowerAnalysisJobIfNeeded,
  getOwnedPowerAnalysisJob,
  mapPowerAnalysisJob,
} from "../../_helpers";

export const runtime = "nodejs";

export async function GET(
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
  return NextResponse.json<ApiData<PowerAnalysisJobDto>>({
    success: true,
    data: mapPowerAnalysisJob(current),
  });
}
