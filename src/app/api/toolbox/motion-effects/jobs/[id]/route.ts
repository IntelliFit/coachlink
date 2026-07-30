import { NextResponse } from "next/server";
import type { ApiData } from "@/types/api";
import {
  getAccessibleMotionEffectJob,
  getMotionEffectRequestIdentity,
} from "../../_commerce";
import {
  expireMotionEffectJobIfNeeded,
  failStaleMotionEffectJobIfNeeded,
  mapMotionEffectJobWithQueueInfo,
} from "../../_helpers";
import type { MotionEffectJobDto } from "../../types";

export const runtime = "nodejs";

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
  const current = await failStaleMotionEffectJobIfNeeded(
    await expireMotionEffectJobIfNeeded(job),
  );
  return NextResponse.json<ApiData<MotionEffectJobDto>>({
    success: true,
    data: await mapMotionEffectJobWithQueueInfo(current),
  });
}
