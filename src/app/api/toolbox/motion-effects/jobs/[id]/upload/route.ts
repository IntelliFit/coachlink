import busboy from "busboy";
import { createWriteStream, openAsBlob } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import {
  MOTION_EFFECTS_BUCKET,
  expireMotionEffectJobIfNeeded,
  getOwnedMotionEffectJob,
  isSupportedVideoContentType,
  mapMotionEffectJob,
} from "../../../_helpers";
import type { MotionEffectJobDto } from "../../../types";

export const runtime = "nodejs";
export const maxDuration = 300;
const db = serviceRoleSupabase as any;

class UploadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function receiveVideo(req: Request, maxSizeBytes: number, fallbackType: string) {
  const requestType = String(req.headers.get("content-type") || "");
  if (!requestType.toLowerCase().startsWith("multipart/form-data") || !req.body) {
    throw new UploadError("上传格式错误", 400);
  }
  const directory = await mkdtemp(join(tmpdir(), "coachlink-motion-upload-"));
  const filePath = join(directory, "input-video");
  try {
    const parsed = await new Promise<{ contentType: string; size: number }>((resolve, reject) => {
      const parser = busboy({
        headers: { "content-type": requestType },
        limits: { fileSize: maxSizeBytes, files: 1, fields: 8, parts: 10 },
      });
      let seen = false;
      let tooLarge = false;
      let invalid = false;
      let size = 0;
      let type = fallbackType;
      let writing: Promise<void> | null = null;
      parser.on("file", (field, file, info) => {
        if (field !== "file" || seen) {
          file.resume();
          return;
        }
        seen = true;
        type = String(info.mimeType || fallbackType);
        if (!isSupportedVideoContentType(type)) {
          invalid = true;
          file.resume();
          return;
        }
        file.on("limit", () => { tooLarge = true; });
        file.on("data", (chunk: Buffer) => { size += chunk.length; });
        writing = pipeline(file, createWriteStream(filePath));
      });
      parser.on("error", reject);
      parser.on("close", async () => {
        try {
          if (writing) await writing;
          if (tooLarge) throw new UploadError("视频超过上传限制", 413);
          if (invalid) throw new UploadError("请上传有效的视频", 400);
          if (!seen || !writing || size <= 0) throw new UploadError("上传内容为空", 400);
          resolve({ contentType: type, size });
        } catch (error) {
          reject(error);
        }
      });
      Readable.fromWeb(req.body as any).pipe(parser);
    });
    return { ...parsed, filePath, directory };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

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
  if (current.status !== "awaiting_upload") {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "任务状态已变化，请重新提交", data: null },
      { status: current.status === "expired" ? 410 : 409 },
    );
  }

  const metadata =
    current.metadata && typeof current.metadata === "object" ? current.metadata : {};
  const maxSizeBytes =
    Math.max(1, Number(process.env.MOTION_EFFECTS_MAX_VIDEO_MB || 100)) *
    1024 *
    1024;
  let received: Awaited<ReturnType<typeof receiveVideo>> | null = null;
  try {
    received = await receiveVideo(
      req,
      maxSizeBytes,
      String(metadata.content_type || "video/mp4"),
    );
    const blob = await openAsBlob(received.filePath, { type: received.contentType });
    if (blob.size !== received.size) throw new UploadError("视频大小校验失败", 500);
    const result = await db.storage
      .from(MOTION_EFFECTS_BUCKET)
      .upload(current.input_storage_path, blob, {
        contentType: received.contentType,
        upsert: false,
      });
    if (result.error) throw new UploadError(result.error.message, 500);
    const info = await db.storage
      .from(MOTION_EFFECTS_BUCKET)
      .info(current.input_storage_path);
    const storedSize = Number(info.data?.size ?? info.data?.metadata?.size ?? 0);
    if (info.error || storedSize !== received.size) {
      await db.storage.from(MOTION_EFFECTS_BUCKET).remove([current.input_storage_path]);
      throw new UploadError("视频写入不完整，请重新上传", 500);
    }

    const { data, error } = await db
      .from("tool_video_render_jobs")
      .update({
        original_file_size_bytes: received.size,
        error_message: null,
        metadata: {
          ...metadata,
          content_type: received.contentType,
          uploaded_size_bytes: received.size,
          uploaded_at: new Date().toISOString(),
          upload_strategy: "server_streaming_multipart_proxy",
        },
      })
      .eq("id", id)
      .eq("user_id", session.user.id)
      .eq("status", "awaiting_upload")
      .select("*")
      .single();
    if (error || !data) throw new UploadError(error?.message || "更新上传记录失败", 500);
    return NextResponse.json<ApiData<MotionEffectJobDto>>({
      success: true,
      message: "上传成功",
      data: mapMotionEffectJob(data),
    });
  } catch (error) {
    const status = error instanceof UploadError ? error.status : 500;
    const message = error instanceof Error ? error.message : "上传失败";
    console.error("[motion-effects/upload] failed:", error);
    return NextResponse.json<ApiData<null>>(
      { success: false, message, data: null },
      { status },
    );
  } finally {
    if (received?.directory) {
      await rm(received.directory, { recursive: true, force: true }).catch(() => null);
    }
  }
}
