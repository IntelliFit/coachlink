import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import {
  MOTION_EFFECTS_BUCKET,
  createMotionEffectDownloadToken,
  expireMotionEffectJobIfNeeded,
  getOwnedMotionEffectJob,
} from "../../../_helpers";
import type { MotionEffectDownloadUrlDto } from "../../../types";

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
  const job = await getOwnedMotionEffectJob(id, session.user.id);
  if (!job) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "任务不存在", data: null },
      { status: 404 },
    );
  }
  const current = await expireMotionEffectJobIfNeeded(job);
  if (current.status !== "done" || !current.output_storage_path) {
    return NextResponse.json<ApiData<null>>(
      {
        success: false,
        message: current.status === "expired" ? "特效视频已过期" : "特效视频还未生成完成",
        data: null,
      },
      { status: current.status === "expired" ? 410 : 400 },
    );
  }
  const expiresInSeconds = 15 * 60;
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const filename = `jiaolian-finger-membrane-${id}.mp4`;
  const proxyUrl = `/api/toolbox/motion-effects/jobs/${encodeURIComponent(id)}/download`;
  const downloadToken = createMotionEffectDownloadToken(
    id,
    current.user_id,
    expires,
  );
  const tokenizedUrl = downloadToken
    ? new URL(
        `${proxyUrl}?expires=${expires}&token=${encodeURIComponent(downloadToken)}`,
        req.url,
      ).toString()
    : "";
  const { data: signed } = await db.storage
    .from(current.output_storage_bucket || MOTION_EFFECTS_BUCKET)
    .createSignedUrl(current.output_storage_path, expiresInSeconds, {
      download: filename,
    });
  return NextResponse.json<ApiData<MotionEffectDownloadUrlDto>>({
    success: true,
    data: {
      url: tokenizedUrl || signed?.signedUrl || new URL(proxyUrl, req.url).toString(),
      proxyUrl,
      signedUrl: signed?.signedUrl,
      expiresInSeconds,
      filename,
    },
  });
}
