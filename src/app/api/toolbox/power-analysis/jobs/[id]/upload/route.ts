import busboy from "busboy";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { PowerAnalysisJobDto } from "../../../types";
import {
  POWER_ANALYSIS_BUCKET,
  expirePowerAnalysisJobIfNeeded,
  getOwnedPowerAnalysisJob,
  getPowerAnalysisLimits,
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

  return await new Promise<{ contentType: string; size: number }>((resolve, reject) => {
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
    let uploadedBytes = 0;
    let uploadedContentType = params.fallbackContentType;
    let uploadPromise: Promise<{ error: any }> | null = null;
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
      uploadedContentType = String(info.mimeType || params.fallbackContentType || "").trim();
      if (!isSupportedVideoContentType(uploadedContentType)) {
        invalidContentType = true;
        file.resume();
        return;
      }

      file.on("limit", () => {
        fileTooLarge = true;
      });
      file.on("data", (chunk: Buffer) => {
        uploadedBytes += chunk.length;
      });

      // Supabase Storage accepts a Node readable stream. This avoids buffering the
      // multipart file in Next.js and then allocating a second full-size ArrayBuffer.
      uploadPromise = db.storage
        .from(POWER_ANALYSIS_BUCKET)
        .upload(params.inputPath, file, {
          contentType: uploadedContentType,
          upsert: false,
        });
    });

    parser.on("filesLimit", () => {
      extraFiles = true;
    });
    parser.on("error", async (error) => {
      await removeIncompleteUpload(params.inputPath);
      fail(error);
    });
    parser.on("close", async () => {
      try {
        const uploadResult = uploadPromise ? await uploadPromise : null;
        if (fileTooLarge) {
          await removeIncompleteUpload(params.inputPath);
          throw new UploadRequestError(
            `视频过大，当前最多支持 ${Math.round(params.maxSizeBytes / 1024 / 1024)}MB`,
            413,
          );
        }
        if (extraFiles) {
          await removeIncompleteUpload(params.inputPath);
          throw new UploadRequestError("每次只能上传一个视频", 400);
        }
        if (invalidContentType) {
          throw new UploadRequestError("请上传有效的视频文件", 400);
        }
        if (!fileSeen || !uploadResult || uploadedBytes <= 0) {
          await removeIncompleteUpload(params.inputPath);
          throw new UploadRequestError("上传内容为空，请重新选择视频", 400);
        }
        if (uploadResult.error) {
          await removeIncompleteUpload(params.inputPath);
          throw new UploadRequestError(uploadResult.error.message || "上传失败", 500);
        }

        if (!settled) {
          settled = true;
          resolve({ contentType: uploadedContentType, size: uploadedBytes });
        }
      } catch (error) {
        fail(error);
      }
    });

    const requestStream = Readable.fromWeb(params.req.body as any);
    requestStream.on("error", async (error) => {
      await removeIncompleteUpload(params.inputPath);
      fail(error);
    });
    requestStream.pipe(parser);
  });
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

  const limits = getPowerAnalysisLimits();
  const maxSizeBytes = limits.maxVideoSizeMb * 1024 * 1024;
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
      fallbackContentType: String(normalizeMetadata(current.metadata).content_type || "video/mp4"),
      maxSizeBytes,
    });
  } catch (error) {
    const status = error instanceof UploadRequestError ? error.status : 500;
    const message = error instanceof Error ? error.message : "上传失败";
    console.error("[power-analysis/upload] streaming upload failed:", error);
    return NextResponse.json<ApiData<null>>(
      { success: false, message, data: null },
      { status },
    );
  }

  const metadata = {
    ...normalizeMetadata(current.metadata),
    content_type: streamedUpload.contentType,
    upload_strategy: "miniapp_server_streaming_multipart_proxy",
    uploaded_at: new Date().toISOString(),
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
