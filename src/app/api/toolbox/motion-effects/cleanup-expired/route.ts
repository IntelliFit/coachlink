import { NextResponse } from "next/server";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { MOTION_EFFECTS_BUCKET } from "../_helpers";

export const runtime = "nodejs";
export const maxDuration = 120;
const db = serviceRoleSupabase as any;

function authorized(req: Request) {
  const secret =
    process.env.MOTION_EFFECTS_CLEANUP_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "";
  const header = String(req.headers.get("authorization") || "");
  return secret
    ? header.toLowerCase().startsWith("bearer ") && header.slice(7).trim() === secret
    : process.env.NODE_ENV !== "production";
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "Unauthorized", data: null },
      { status: 401 },
    );
  }
  const { data: rows, error } = await db
    .from("tool_video_render_jobs")
    .select("id,input_storage_bucket,input_storage_path,output_storage_bucket,output_storage_path")
    .neq("status", "expired")
    .lt("expires_at", new Date().toISOString())
    .limit(100);
  if (error) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: error.message, data: null },
      { status: 500 },
    );
  }

  let removedFiles = 0;
  for (const row of rows || []) {
    const paths = [row.input_storage_path, row.output_storage_path].filter(Boolean);
    if (!paths.length) continue;
    const result = await db.storage
      .from(row.input_storage_bucket || row.output_storage_bucket || MOTION_EFFECTS_BUCKET)
      .remove(paths);
    if (!result.error) removedFiles += paths.length;
  }
  if (rows?.length) {
    await db
      .from("tool_video_render_jobs")
      .update({ status: "expired", progress: 100 })
      .in("id", rows.map((row: any) => row.id));
  }
  return NextResponse.json<ApiData<{ expiredJobs: number; removedFiles: number }>>({
    success: true,
    data: { expiredJobs: rows?.length || 0, removedFiles },
  });
}
