import { openAsBlob } from "node:fs";
import { appendFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { cosDownloadFile, cosRemove, cosUpload } from "@/lib/cos";
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

const db = serviceRoleSupabase as any;
const TEMP_CHUNK_BUCKET = "videos";
const MAX_CHUNK_BYTES = 6 * 1024 * 1024;
// The miniapp sends 4MB chunks, so 128 chunks cover the current 500MB premium limit.
const MAX_TOTAL_CHUNKS = 128;
const UPLOAD_ID_PATTERN = /^[a-zA-Z0-9_-]{8,96}$/;

interface CompleteChunkedUploadBody {
  uploadId?: string;
  totalSize?: number;
  totalChunks?: number;
  contentType?: string;
}

function normalizeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

class PowerChunkUploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PowerChunkUploadError";
  }
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 96) || "unknown";
}

function assertUploadId(value: unknown) {
  const uploadId = String(value || "");
  if (!UPLOAD_ID_PATTERN.test(uploadId)) {
    throw new PowerChunkUploadError("上传任务参数错误", 400);
  }
  return uploadId;
}

function readInteger(value: unknown, name: string, minimum: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new PowerChunkUploadError(`${name} 参数错误`, 400);
  }
  return parsed;
}

function getUploadDir(userId: string, jobId: string, uploadId: string) {
  return join(
    tmpdir(),
    "coachlink-power-analysis-chunks",
    safeSegment(userId),
    safeSegment(jobId),
    uploadId,
  );
}

function getUserUploadRoot(userId: string) {
  return join(tmpdir(), "coachlink-power-analysis-chunks", safeSegment(userId));
}

function getChunkPath(uploadDir: string, chunkIndex: number) {
  return join(uploadDir, `${chunkIndex}.part`);
}

function getChunkStorageKey(userId: string, jobId: string, uploadId: string, chunkIndex: number) {
  return [
    "_tmp",
    "power-analysis-chunks",
    safeSegment(userId),
    safeSegment(jobId),
    uploadId,
    `${chunkIndex}.part`,
  ].join("/");
}

function getChunkStorageKeys(
  userId: string,
  jobId: string,
  uploadId: string,
  totalChunks: number,
) {
  return Array.from({ length: totalChunks }, (_, index) =>
    getChunkStorageKey(userId, jobId, uploadId, index),
  );
}

async function cleanupStaleUploadDirs(userId: string) {
  const root = getUserUploadRoot(userId);
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const staleBefore = Date.now() - 6 * 60 * 60 * 1000;
  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const directory = join(root, entry.name);
        const info = await stat(directory).catch(() => null);
        if (info && info.mtimeMs < staleBefore) {
          await rm(directory, { recursive: true, force: true }).catch(() => null);
        }
      }),
  );
}

function getExpectedSize(current: any) {
  const size = Number(current?.original_file_size_bytes || 0);
  if (!Number.isInteger(size) || size <= 0) {
    throw new PowerChunkUploadError("任务缺少视频大小，请重新选择", 400);
  }
  return size;
}

function assertTotalSize(current: any, totalSize: number) {
  const expectedSize = getExpectedSize(current);
  const metadata = normalizeMetadata(current?.metadata);
  const maxVideoSizeMb = Number(metadata.max_video_size_mb || 100);
  const maxBytes = Math.max(1, maxVideoSizeMb) * 1024 * 1024;
  if (totalSize !== expectedSize) {
    throw new PowerChunkUploadError("视频大小与任务记录不一致，请重新选择", 400);
  }
  if (totalSize > maxBytes) {
    throw new PowerChunkUploadError(`视频过大，当前最多支持 ${maxVideoSizeMb}MB`, 413);
  }
}

async function handleChunk(req: Request, userId: string, jobId: string, current: any, url: URL) {
  const uploadId = assertUploadId(url.searchParams.get("uploadId"));
  const chunkIndex = readInteger(url.searchParams.get("chunkIndex"), "chunkIndex", 0);
  const totalChunks = readInteger(url.searchParams.get("totalChunks"), "totalChunks", 1);
  if (totalChunks > MAX_TOTAL_CHUNKS || chunkIndex >= totalChunks) {
    throw new PowerChunkUploadError("视频分片数量超出范围", 400);
  }
  assertTotalSize(current, readInteger(url.searchParams.get("totalSize"), "totalSize", 1));

  const body = await req.arrayBuffer();
  if (body.byteLength <= 0) {
    throw new PowerChunkUploadError("视频分片为空，请重新选择", 400);
  }
  if (body.byteLength > MAX_CHUNK_BYTES) {
    throw new PowerChunkUploadError("单个视频分片过大", 413);
  }

  if (chunkIndex === 0) {
    await cleanupStaleUploadDirs(userId);
  }
  await cosUpload(
    TEMP_CHUNK_BUCKET,
    getChunkStorageKey(userId, jobId, uploadId, chunkIndex),
    Buffer.from(body),
    { contentType: "application/octet-stream", cacheControl: "no-store" },
  );

  return NextResponse.json<ApiData<{ chunkIndex: number }>>({
    success: true,
    message: "视频分片上传成功",
    data: { chunkIndex },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadChunkWithRetry(
  userId: string,
  jobId: string,
  uploadId: string,
  chunkIndex: number,
  chunkPath: string,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await cosDownloadFile(
        TEMP_CHUNK_BUCKET,
        getChunkStorageKey(userId, jobId, uploadId, chunkIndex),
        chunkPath,
      );
      return;
    } catch (error) {
      lastError = error;
      await sleep(250 * (attempt + 1));
    }
  }
  throw lastError;
}

async function downloadAndMergeChunks(params: {
  userId: string;
  jobId: string;
  uploadId: string;
  totalChunks: number;
  totalSize: number;
  uploadDir: string;
  mergedPath: string;
}) {
  await mkdir(params.uploadDir, { recursive: true });
  await writeFile(params.mergedPath, Buffer.alloc(0));
  let receivedSize = 0;

  for (let index = 0; index < params.totalChunks; index += 1) {
    const chunkPath = getChunkPath(params.uploadDir, index);
    try {
      await downloadChunkWithRetry(
        params.userId,
        params.jobId,
        params.uploadId,
        index,
        chunkPath,
      );
    } catch {
      throw new PowerChunkUploadError(`第 ${index + 1} 个视频分片缺失`, 400);
    }
    const info = await stat(chunkPath).catch(() => null);
    if (!info?.isFile() || info.size <= 0) {
      throw new PowerChunkUploadError(`第 ${index + 1} 个视频分片无效`, 400);
    }
    receivedSize += info.size;
    await appendFile(params.mergedPath, await readFile(chunkPath));
  }

  if (receivedSize !== params.totalSize) {
    throw new PowerChunkUploadError("视频分片合并大小不一致，请重新上传", 400);
  }
}

async function removeIncompleteUpload(inputPath: string) {
  await db.storage.from(POWER_ANALYSIS_BUCKET).remove([inputPath]).catch(() => null);
}

async function handleComplete(
  req: Request,
  userId: string,
  jobId: string,
  current: any,
) {
  let body: CompleteChunkedUploadBody;
  try {
    body = (await req.json()) as CompleteChunkedUploadBody;
  } catch {
    throw new PowerChunkUploadError("请求参数错误", 400);
  }

  const uploadId = assertUploadId(body.uploadId);
  const totalChunks = readInteger(body.totalChunks, "totalChunks", 1);
  const totalSize = readInteger(body.totalSize, "totalSize", 1);
  if (totalChunks > MAX_TOTAL_CHUNKS) {
    throw new PowerChunkUploadError("视频分片数量超出范围", 400);
  }
  assertTotalSize(current, totalSize);

  const contentType = String(body.contentType || "video/mp4").trim().toLowerCase();
  if (!isSupportedVideoContentType(contentType)) {
    throw new PowerChunkUploadError("请上传有效的视频文件", 400);
  }
  const inputPath = String(current.input_storage_path || "");
  if (!inputPath) {
    throw new PowerChunkUploadError("任务缺少上传路径", 500);
  }

  const uploadDir = getUploadDir(userId, jobId, uploadId);
  const mergedPath = join(uploadDir, "merged-video");
  const chunkKeys = getChunkStorageKeys(userId, jobId, uploadId, totalChunks);

  try {
    await downloadAndMergeChunks({
      userId,
      jobId,
      uploadId,
      totalChunks,
      totalSize,
      uploadDir,
      mergedPath,
    });
    const mergedInfo = await stat(mergedPath);
    if (!mergedInfo.isFile() || mergedInfo.size !== totalSize) {
      throw new PowerChunkUploadError("合并后视频大小校验失败", 500);
    }

    const fileBlob = await openAsBlob(mergedPath, { type: contentType });
    const uploadResult = await db.storage
      .from(POWER_ANALYSIS_BUCKET)
      .upload(inputPath, fileBlob, { contentType, upsert: false });
    if (uploadResult.error) {
      throw new PowerChunkUploadError(uploadResult.error.message || "视频写入失败", 500);
    }

    const { data: storedObject, error: infoError } = await db.storage
      .from(POWER_ANALYSIS_BUCKET)
      .info(inputPath);
    const storedSize = Number(storedObject?.size ?? storedObject?.metadata?.size ?? -1);
    if (infoError || storedSize !== totalSize) {
      await removeIncompleteUpload(inputPath);
      throw new PowerChunkUploadError("视频写入不完整，请重新上传", 500);
    }

    const metadata = normalizeMetadata(current.metadata);
    const { data, error: updateError } = await db
      .from("tool_power_analysis_jobs")
      .update({
        metadata: {
          ...metadata,
          content_type: contentType,
          upload_strategy: "miniapp_binary_chunks_v1",
          uploaded_at: new Date().toISOString(),
          uploaded_size_bytes: totalSize,
          upload_failure_stage: null,
          upload_failure_message: null,
        },
        original_file_size_bytes: totalSize,
        error_message: null,
      })
      .eq("id", jobId)
      .eq("user_id", userId)
      .eq("status", "awaiting_upload")
      .select("*")
      .single();
    if (updateError || !data) {
      throw new PowerChunkUploadError(updateError?.message || "上传记录更新失败", 500);
    }

    return NextResponse.json<ApiData<PowerAnalysisJobDto>>({
      success: true,
      message: "视频上传成功",
      data: mapPowerAnalysisJob(data),
    });
  } catch (error) {
    await removeIncompleteUpload(inputPath);
    throw error;
  } finally {
    await Promise.all([
      rm(uploadDir, { recursive: true, force: true }).catch(() => null),
      cosRemove(TEMP_CHUNK_BUCKET, chunkKeys).catch((error) => {
        console.warn("[power-analysis/upload-chunk] cleanup failed:", error);
      }),
    ]);
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  let current: any = null;
  let userId = "";
  let id = "";
  let action = "chunk";
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json<ApiData<null>>(
        { success: false, message: "用户未登录", data: null },
        { status: 401 },
      );
    }
    userId = session.user.id;
    ({ id } = await context.params);
    const job = await getOwnedPowerAnalysisJob(id, userId);
    if (!job) {
      throw new PowerChunkUploadError("任务不存在", 404);
    }
    current = await expirePowerAnalysisJobIfNeeded(job);
    if (current.status === "expired") {
      throw new PowerChunkUploadError("任务已过期，请重新上传", 410);
    }
    if (current.status !== "awaiting_upload") {
      throw new PowerChunkUploadError("任务状态已变化，请重新提交", 409);
    }

    const url = new URL(req.url);
    action = url.searchParams.get("action") || "chunk";
    if (action === "chunk") {
      return await handleChunk(req, userId, id, current, url);
    }
    if (action === "complete") {
      return await handleComplete(req, userId, id, current);
    }
    throw new PowerChunkUploadError("上传动作参数错误", 400);
  } catch (error) {
    const status = error instanceof PowerChunkUploadError ? error.status : 500;
    const message = error instanceof Error ? error.message : "视频上传失败";
    console.error("[power-analysis/upload-chunk] failed:", error);

    if (current && userId && id && action === "complete") {
      try {
        const metadata = normalizeMetadata(current.metadata);
        const { error: updateError } = await db
          .from("tool_power_analysis_jobs")
          .update({
            metadata: {
              ...metadata,
              upload_failed_at: new Date().toISOString(),
              upload_failure_stage: "chunk_merge_or_storage_write",
              upload_failure_message: message.slice(0, 500),
            },
            error_message: message.slice(0, 1000),
          })
          .eq("id", id)
          .eq("user_id", userId)
          .eq("status", "awaiting_upload");
        if (updateError) {
          console.warn("[power-analysis/upload-chunk] failure metadata update failed:", updateError.message);
        }
      } catch (updateError) {
        console.warn("[power-analysis/upload-chunk] failure metadata update failed:", updateError);
      }
    }

    return NextResponse.json<ApiData<null>>(
      { success: false, message, data: null },
      { status },
    );
  }
}
