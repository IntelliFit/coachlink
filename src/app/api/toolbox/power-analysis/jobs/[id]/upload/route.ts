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
import type { PowerAnalysisJobDto } from "../../../types";
import {
  POWER_ANALYSIS_BUCKET,
  expirePowerAnalysisJobIfNeeded,
  getOwnedPowerAnalysisJob,
  isSupportedVideoContentType,
  mapPowerAnalysisJob,
} from "../../../_helpers";

export const runtime = "nodejs";
export const maxDuration = 300;
export const preferredRegion = "auto";

const db = serviceRoleSupabase as any;

function normalizeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

class UploadRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "UploadRequestError";
  }
}

async function removeIncompleteUpload(inputPath: string) {
  await db.storage.from(POWER_ANALYSIS_BUCKET).remove([inputPath]).catch(() => null);
}

async function streamMultipartVideoToStorage(params: {
  req: Request;
  inputPath: string;
  fallbackContentType: string;
  maxSizeBytes: number;
}) {
  const requestContentType = String(params.req.headers.get("content-type") || "");
  if (!requestContentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new UploadRequestError("上传格式错误，请重新选择视频", 400);
  }
  if (!params.req.body) {
    throw new UploadRequestError("上传内容为空，请重新选择视频", 400);
  }

  const tempDirectory = await mkdtemp(join(tmpdir(), "coachlink-power-upload-"));
  const tempFilePath = join(tempDirectory, "input-video");

  try {
    const parsed = await new Promise<{ contentType: string; size: number }>((resolve, reject) => {
      const parser = busboy({
        headers: { "content-type": requestContentType },
        limits: {
          fileSize: params.maxSizeBytes,
          files: 1,
          fields: 8,
          parts: 10,
        },
      });

      let fileSeen = false;
      let fileTooLarge = false;
      let invalidContentType = false;
      let extraFiles = false;
      let receivedBytes = 0;
      let receivedContentType = params.fallbackContentType;
      let writePromise: Promise<void> | null = null;
      let settled = false;

      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      parser.on("file", (fieldName, file, info) => {
        if (fieldName !== "file" || fileSeen) {
          file.resume();
          return;
        }

        fileSeen = true;
        receivedContentType = String(info.mimeType || params.fallbackContentType || "").trim();
        if (!isSupportedVideoContentType(receivedContentType)) {
          invalidContentType = true;
          file.resume();
          return;
        }

        file.on("limit", () => {
          fileTooLarge = true;
        });
        file.on("data", (chunk: Buffer) => {
          receivedBytes += chunk.length;
        });

        // Do not pass Busboy's live stream directly into Supabase Storage. In the
        // Next.js runtime that request can succeed while Storage persists an empty
        // object. Spooling to disk keeps memory bounded and gives the upload a
        // stable Blob with a known byte length.
        writePromise = pipeline(file, createWriteStream(tempFilePath));
      });

      parser.on("filesLimit", () => {
        extraFiles = true;
      });
      parser.on("error", fail);
      parser.on("close", async () => {
        try {
          if (writePromise) await writePromise;
          if (fileTooLarge) {
            throw new UploadRequestError(
              `视频过大，当前最多支持 ${Math.round(params.maxSizeBytes / 1024 / 1024)}MB`,
              413,
            );
          }
          if (extraFiles) {
            throw new UploadRequestError("每次只能上传一个视频", 400);
          }
          if (invalidContentType) {
            throw new UploadRequestError("请上传有效的视频文件", 400);
          }
          if (!fileSeen || !writePromise || receivedBytes <= 0) {
            throw new UploadRequestError("上传内容为空，请重新选择视频", 400);
          }

          if (!settled) {
            settled = true;
            resolve({ contentType: receivedContentType, size: receivedBytes });
          }
        } catch (error) {
          fail(error);
        }
      });

      const requestStream = Readable.fromWeb(params.req.body as any);
      requestStream.on("error", fail);
      requestStream.pipe(parser);
    });

    const fileBlob = await openAsBlob(tempFilePath, { type: parsed.contentType });
    if (fileBlob.size !== parsed.size) {
      throw new UploadRequestError("上传文件大小校验失败，请重新选择视频", 500);
    }

    const uploadResult = await db.storage
      .from(POWER_ANALYSIS_BUCKET)
      .upload(params.inputPath, fileBlob, {
        contentType: parsed.contentType,
        upsert: false,
      });
    if (uploadResult.error) {
      throw new UploadRequestError(uploadResult.error.message || "上传失败", 500);
    }

    const { data: storedObject, error: infoError } = await db.storage
      .from(POWER_ANALYSIS_BUCKET)
      .info(params.inputPath);
    const storedSize = Number(storedObject?.size ?? storedObject?.metadata?.size ?? -1);
    if (infoError || storedSize !== parsed.size) {
      throw new UploadRequestError("视频写入不完整，请重新上传", 500);
    }

    return parsed;
  } catch (error) {
    await removeIncompleteUpload(params.inputPath);
    throw error;
  } finally {
    await rm(tempDirectory, { recursive: true, force: true }).catch(() => null);
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
      { success: false, message: "任务已过期，请重新上传", data: null },
      { status: 410 },
    );
  }

  if (current.status !== "awaiting_upload") {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "任务状态已变化，请重新提交", data: null },
      { status: 409 },
    );
  }

  const currentMetadata = normalizeMetadata(current.metadata);
  const configuredMaxMb = Number(currentMetadata.max_video_size_mb || 100);
  const maxVideoSizeMb = Number.isFinite(configuredMaxMb) && configuredMaxMb > 0
    ? configuredMaxMb
    : 100;
  const maxSizeBytes = maxVideoSizeMb * 1024 * 1024;
  const inputPath = String(current.input_storage_path || "");
  if (!inputPath) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "任务缺少上传路径", data: null },
      { status: 500 },
    );
  }

  let streamedUpload: { contentType: string; size: number };
  try {
    streamedUpload = await streamMultipartVideoToStorage({
      req,
      inputPath,
      fallbackContentType: String(currentMetadata.content_type || "video/mp4"),
      maxSizeBytes,
    });
  } catch (error) {
    const status = error instanceof UploadRequestError ? error.status : 500;
    const message = error instanceof Error ? error.message : "上传失败";
    console.error("[power-analysis/upload] streaming upload failed:", error);
    await db
      .from("tool_power_analysis_jobs")
      .update({
        metadata: {
          ...currentMetadata,
          upload_failed_at: new Date().toISOString(),
          upload_failure_stage: "multipart_receive_or_storage_write",
          upload_failure_message: message.slice(0, 500),
        },
        error_message: message.slice(0, 1000),
      })
      .eq("id", id)
      .eq("user_id", session.user.id)
      .eq("status", "awaiting_upload")
      .catch(() => null);
    return NextResponse.json<ApiData<null>>(
      { success: false, message, data: null },
      { status },
    );
  }

  const metadata = {
    ...currentMetadata,
    content_type: streamedUpload.contentType,
    upload_strategy: "miniapp_server_streaming_multipart_proxy",
    uploaded_at: new Date().toISOString(),
    uploaded_size_bytes: Math.round(streamedUpload.size),
    upload_failure_stage: null,
    upload_failure_message: null,
  };

  const { data, error: updateError } = await db
    .from("tool_power_analysis_jobs")
    .update({
      metadata,
      original_file_size_bytes: Math.round(streamedUpload.size),
      error_message: null,
    })
    .eq("id", id)
    .eq("user_id", session.user.id)
    .eq("status", "awaiting_upload")
    .select("*")
    .single();

  if (updateError || !data) {
    console.error("[power-analysis/upload] metadata update failed:", updateError);
    return NextResponse.json<ApiData<null>>(
      { success: false, message: updateError?.message || "上传记录更新失败", data: null },
      { status: 500 },
    );
  }

  return NextResponse.json<ApiData<PowerAnalysisJobDto>>({
    success: true,
    message: "上传成功",
    data: mapPowerAnalysisJob(data),
  });
}
