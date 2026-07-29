import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type { ApiData } from "@/types/api";
import {
  expireMotionEffectJobIfNeeded,
  failStaleMotionEffectJobIfNeeded,
  getOwnedMotionEffectJob,
  mapMotionEffectJobWithQueueInfo,
} from "../../_helpers";
import type { MotionEffectJobDto } from "../../types";

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
  const job = await getOwnedMotionEffectJob(id, session.user.id);
  if (!job) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "任务不存在", data: null },
      { status: 404 },
    );
  }
  const current = await failStaleMotionEffectJobIfNeeded(
    await expireMotionEffectJobIfNeeded(job),
  );
  return NextResponse.json<ApiData<MotionEffectJobDto>>({
    success: true,
    data: await mapMotionEffectJobWithQueueInfo(current),
  });
}
