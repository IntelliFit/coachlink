import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import {
  appendPowerAnalysisClientEvent,
  parsePowerAnalysisClientEvent,
} from "@/lib/powerAnalysisClientEvent";
import type { ApiData } from "@/types/api";
import { getOwnedPowerAnalysisJob } from "../../../_helpers";

export const runtime = "nodejs";

const db = serviceRoleSupabase as any;

function normalizeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

/** Records why a job never reached the queue (failed upload, user left). Best effort. */
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "用户未登录", data: null },
      { status: 401 },
    );
  }

  const event = parsePowerAnalysisClientEvent(await req.json().catch(() => null));
  if (!event) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "事件格式不正确", data: null },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  // Two attempts: the upload routes also write metadata, and a stale write would erase theirs.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const job = await getOwnedPowerAnalysisJob(id, session.user.id);
    if (!job) {
      return NextResponse.json<ApiData<null>>(
        { success: false, message: "任务不存在", data: null },
        { status: 404 },
      );
    }
    if (job.status !== "awaiting_upload") {
      return NextResponse.json<ApiData<null>>({ success: true, message: "任务已进入分析，忽略", data: null });
    }
    const { data, error } = await db
      .from("tool_power_analysis_jobs")
      .update({ metadata: appendPowerAnalysisClientEvent(normalizeMetadata(job.metadata), event) })
      .eq("id", id)
      .eq("updated_at", job.updated_at)
      .select("id");
    if (error) {
      console.warn("[power-analysis] client event write failed:", { jobId: id, message: error.message });
      return NextResponse.json<ApiData<null>>(
        { success: false, message: "记录失败", data: null },
        { status: 500 },
      );
    }
    if (Array.isArray(data) && data.length > 0) {
      return NextResponse.json<ApiData<null>>({ success: true, message: "已记录", data: null });
    }
  }
  return NextResponse.json<ApiData<null>>({ success: true, message: "任务正在更新，已跳过", data: null });
}
