import { NextResponse } from "next/server";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { POWER_ANALYSIS_BUCKET } from "../_helpers";

export const runtime = "nodejs";
export const maxDuration = 120;

const db = serviceRoleSupabase as any;

function getBearer(req: Request) {
  const raw = req.headers.get("authorization") || "";
  return raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : "";
}

function isAuthorized(req: Request) {
  const configured =
    process.env.POWER_ANALYSIS_CLEANUP_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "";
  if (!configured) return process.env.NODE_ENV !== "production";
  return getBearer(req) === configured;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "Unauthorized", data: null },
      { status: 401 },
    );
  }

  const now = new Date().toISOString();
  const { data: rows, error } = await db
    .from("tool_power_analysis_jobs")
    .select("id, input_storage_bucket, input_storage_path, output_storage_bucket, output_storage_path")
    // Canceled jobs removed their files when canceled and keep their status.
    .not("status", "in", "(expired,canceled)")
    .lt("expires_at", now)
    .limit(100);

  if (error) {
    console.error("[power-analysis/cleanup-expired] list failed:", error);
    return NextResponse.json<ApiData<null>>(
      { success: false, message: error.message || "查询过期任务失败", data: null },
      { status: 500 },
    );
  }

  const jobs = rows || [];
  let removedFiles = 0;
  for (const job of jobs) {
    const byBucket = new Map<string, string[]>();
    const add = (bucket: string | null, path: string | null) => {
      if (!path) return;
      const b = bucket || POWER_ANALYSIS_BUCKET;
      byBucket.set(b, [...(byBucket.get(b) || []), path]);
    };
    add(job.input_storage_bucket, job.input_storage_path);
    add(job.output_storage_bucket, job.output_storage_path);

    for (const [bucket, paths] of byBucket.entries()) {
      if (paths.length === 0) continue;
      const { error: removeError } = await db.storage.from(bucket).remove(paths);
      if (removeError) {
        console.warn("[power-analysis/cleanup-expired] remove failed:", {
          jobId: job.id,
          bucket,
          paths,
          error: removeError.message,
        });
      } else {
        removedFiles += paths.length;
      }
    }
  }

  if (jobs.length > 0) {
    const { error: updateError } = await db
      .from("tool_power_analysis_jobs")
      .update({ status: "expired", progress: 100 })
      .in("id", jobs.map((job: any) => job.id));

    if (updateError) {
      console.error("[power-analysis/cleanup-expired] update failed:", updateError);
      return NextResponse.json<ApiData<null>>(
        { success: false, message: updateError.message || "更新过期状态失败", data: null },
        { status: 500 },
      );
    }
  }

  return NextResponse.json<ApiData<{ expiredJobs: number; removedFiles: number }>>({
    success: true,
    data: {
      expiredJobs: jobs.length,
      removedFiles,
    },
  });
}
