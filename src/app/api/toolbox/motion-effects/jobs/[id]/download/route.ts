import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import {
  MOTION_EFFECTS_BUCKET,
  expireMotionEffectJobIfNeeded,
  getOwnedMotionEffectJob,
  verifyMotionEffectDownloadToken,
} from "../../../_helpers";

export const runtime = "nodejs";
const db = serviceRoleSupabase as any;

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  const { id } = await context.params;
  let job = session?.user?.id
    ? await getOwnedMotionEffectJob(id, session.user.id)
    : null;
  if (!job) {
    const url = new URL(req.url);
    const expires = Number(url.searchParams.get("expires") || 0);
    const token = String(url.searchParams.get("token") || "");
    const { data: tokenJob } = await db
      .from("tool_video_render_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (
      tokenJob &&
      verifyMotionEffectDownloadToken({
        jobId: id,
        userId: tokenJob.user_id,
        expires,
        token,
      })
    ) {
      job = tokenJob;
    }
  }
  if (!job) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "下载链接无效或已过期", data: null },
      { status: session?.user?.id ? 404 : 401 },
    );
  }
  const current = await expireMotionEffectJobIfNeeded(job);
  if (current.status === "expired") {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "特效视频已过期，请重新生成", data: null },
      { status: 410 },
    );
  }
  if (current.status !== "done" || !current.output_storage_path) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "特效视频还未生成完成", data: null },
      { status: 400 },
    );
  }
  const { data, error } = await db.storage
    .from(current.output_storage_bucket || MOTION_EFFECTS_BUCKET)
    .download(current.output_storage_path)
    .asStream();
  if (error || !data) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "下载特效视频失败", data: null },
      { status: 500 },
    );
  }
  return new NextResponse(data as any, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `${new URL(req.url).searchParams.has("token") ? "inline" : "attachment"}; filename="jiaolian-finger-membrane-${id}.mp4"`,
      "Cache-Control": "private, no-store",
    },
  });
}
