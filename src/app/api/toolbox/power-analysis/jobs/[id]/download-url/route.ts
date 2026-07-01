import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { PowerAnalysisDownloadUrlResponseDto } from "../../../types";
import {
  POWER_ANALYSIS_BUCKET,
  expirePowerAnalysisJobIfNeeded,
  getOwnedPowerAnalysisJob,
} from "../../../_helpers";

export const runtime = "nodejs";

const db = serviceRoleSupabase as any;

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
      { success: false, message: "分析视频已过期，请重新上传分析", data: null },
      { status: 410 },
    );
  }

  if (current.status !== "done" || !current.output_storage_path) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "分析还未完成", data: null },
      { status: 400 },
    );
  }

  const expiresInSeconds = 15 * 60;
  const filename = `coachlink-power-analysis-${current.mode}-${current.id}.mp4`;
  const proxyUrl = `/api/toolbox/power-analysis/jobs/${encodeURIComponent(current.id)}/download`;
  const { data: signed, error: signedError } = await db.storage
    .from(current.output_storage_bucket || POWER_ANALYSIS_BUCKET)
    .createSignedUrl(current.output_storage_path, expiresInSeconds, {
      download: filename,
    });

  if (signedError) {
    console.warn("[power-analysis/download-url] signed fallback failed:", signedError.message);
  }

  return NextResponse.json<ApiData<PowerAnalysisDownloadUrlResponseDto>>({
    success: true,
    data: {
      url: signed?.signedUrl || new URL(proxyUrl, req.url).toString(),
      proxyUrl,
      signedUrl: signed?.signedUrl,
      expiresInSeconds,
      filename,
    },
  });
}
