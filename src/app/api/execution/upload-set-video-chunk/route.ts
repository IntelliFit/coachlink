import { appendFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { buildDatedKey, cosUploadFile } from "@/lib/cos";
import type { ApiData } from "@/types/api";
import type { UploadSetVideoResponseDto } from "../upload-set-video/entity";
import {
    prepareSetVideoUpload,
    persistSetVideoUpload,
    SetVideoUploadError,
} from "../_helpers/setVideoUpload";

export const runtime = "nodejs";
export const maxDuration = 300;
export const preferredRegion = "auto";

const MAX_CHUNK_BYTES = 6 * 1024 * 1024;
const UPLOAD_ID_PATTERN = /^[a-zA-Z0-9_-]{8,96}$/;

interface CompleteChunkedUploadBody {
    uploadId?: string;
    executionId?: string;
    actionId?: string;
    setNumber?: number | string;
    fileName?: string;
    contentType?: string;
    totalSize?: number;
    totalChunks?: number;
}

function safeSegment(value: string) {
    return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 96) || "unknown";
}

function getUploadDir(userId: string, uploadId: string) {
    return join(
        tmpdir(),
        "coachlink-execution-set-video-chunks",
        safeSegment(userId),
        uploadId,
    );
}

function getUserUploadRoot(userId: string) {
    return join(
        tmpdir(),
        "coachlink-execution-set-video-chunks",
        safeSegment(userId),
    );
}

function getChunkPath(uploadDir: string, chunkIndex: number) {
    return join(uploadDir, `${chunkIndex}.part`);
}

async function cleanupStaleUploadDirs(userId: string) {
    const userUploadRoot = getUserUploadRoot(userId);
    const entries = await readdir(userUploadRoot, { withFileTypes: true }).catch(() => []);
    const staleBefore = Date.now() - 6 * 60 * 60 * 1000;
    await Promise.all(
        entries
            .filter((entry) => entry.isDirectory())
            .map(async (entry) => {
                const dir = join(userUploadRoot, entry.name);
                const info = await stat(dir).catch(() => null);
                if (info && info.mtimeMs < staleBefore) {
                    await rm(dir, { recursive: true, force: true }).catch(() => null);
                }
            }),
    );
}

function readPositiveInteger(value: string | null, name: string) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new SetVideoUploadError(`${name} 参数错误`, 400);
    }
    return parsed;
}

function readNonNegativeInteger(value: string | null, name: string) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new SetVideoUploadError(`${name} 参数错误`, 400);
    }
    return parsed;
}

function assertUploadId(value: string | null | undefined) {
    const uploadId = String(value || "");
    if (!UPLOAD_ID_PATTERN.test(uploadId)) {
        throw new SetVideoUploadError("上传任务参数错误", 400);
    }
    return uploadId;
}

function normalizeContentType(value: unknown) {
    const contentType = String(value || "").trim().toLowerCase();
    if (contentType.startsWith("video/")) return contentType;
    return "video/mp4";
}

function getFileExtension(fileName: unknown) {
    const name = String(fileName || "video.mp4").split(/[\\/]/).pop() || "video.mp4";
    const ext = name.includes(".") ? name.split(".").pop() : "mp4";
    return ext && /^[a-z0-9]{1,12}$/i.test(ext) ? ext.toLowerCase() : "mp4";
}

async function handleChunk(req: Request, userId: string, url: URL) {
    const uploadId = assertUploadId(url.searchParams.get("uploadId"));
    const chunkIndex = readNonNegativeInteger(url.searchParams.get("chunkIndex"), "chunkIndex");
    const totalChunks = readPositiveInteger(url.searchParams.get("totalChunks"), "totalChunks");

    if (chunkIndex >= totalChunks) {
        throw new SetVideoUploadError("分片序号超出范围", 400);
    }

    const body = await req.arrayBuffer();
    if (body.byteLength <= 0) {
        throw new SetVideoUploadError("分片内容为空", 400);
    }
    if (body.byteLength > MAX_CHUNK_BYTES) {
        throw new SetVideoUploadError("单个分片过大，请重新上传", 413);
    }

    const uploadDir = getUploadDir(userId, uploadId);
    if (chunkIndex === 0) {
        await cleanupStaleUploadDirs(userId);
    }
    await mkdir(uploadDir, { recursive: true });
    await writeFile(getChunkPath(uploadDir, chunkIndex), Buffer.from(body));

    return NextResponse.json<ApiData<{ chunkIndex: number }>>({
        success: true,
        message: "分片上传成功",
        data: { chunkIndex },
    });
}

async function assertChunksReady(uploadDir: string, totalChunks: number, totalSize: number) {
    let receivedSize = 0;
    for (let index = 0; index < totalChunks; index += 1) {
        let info;
        try {
            info = await stat(getChunkPath(uploadDir, index));
        } catch {
            throw new SetVideoUploadError(`第 ${index + 1} 个分片缺失，请重新上传`, 400);
        }
        if (!info.isFile() || info.size <= 0) {
            throw new SetVideoUploadError(`第 ${index + 1} 个分片无效，请重新上传`, 400);
        }
        receivedSize += info.size;
    }

    if (receivedSize !== totalSize) {
        throw new SetVideoUploadError("上传文件大小校验失败，请重新选择视频", 400);
    }
}

async function mergeChunks(uploadDir: string, totalChunks: number, mergedPath: string) {
    await writeFile(mergedPath, Buffer.alloc(0));
    for (let index = 0; index < totalChunks; index += 1) {
        const chunk = await readFile(getChunkPath(uploadDir, index));
        await appendFile(mergedPath, chunk);
    }
}

async function handleComplete(req: Request, userId: string) {
    let body: CompleteChunkedUploadBody;
    try {
        body = (await req.json()) as CompleteChunkedUploadBody;
    } catch {
        throw new SetVideoUploadError("请求参数错误", 400);
    }

    const uploadId = assertUploadId(body.uploadId);
    const totalChunks = readPositiveInteger(String(body.totalChunks || ""), "totalChunks");
    const totalSize = readPositiveInteger(String(body.totalSize || ""), "totalSize");
    const uploadDir = getUploadDir(userId, uploadId);
    const mergedPath = join(uploadDir, "merged-video");

    const prepared = await prepareSetVideoUpload({
        userId,
        executionId: String(body.executionId || ""),
        actionId: String(body.actionId || ""),
        setNumber: body.setNumber,
        fileSizeBytes: totalSize,
    });

    try {
        await assertChunksReady(uploadDir, totalChunks, totalSize);
        await mergeChunks(uploadDir, totalChunks, mergedPath);

        const mergedInfo = await stat(mergedPath);
        if (!mergedInfo.isFile() || mergedInfo.size !== totalSize) {
            throw new SetVideoUploadError("合并后文件大小校验失败，请重新上传", 500);
        }

        const storagePath = buildDatedKey(
            getFileExtension(body.fileName),
            userId,
            "executions",
        );
        const uploaded = await cosUploadFile("videos", storagePath, mergedPath, {
            contentType: normalizeContentType(body.contentType),
        });

        const data = await persistSetVideoUpload({
            prepared,
            videoUrl: uploaded.url,
            storagePath,
        });

        return NextResponse.json<ApiData<UploadSetVideoResponseDto>>({
            success: true,
            message: "上传视频成功",
            data,
        });
    } finally {
        await rm(uploadDir, { recursive: true, force: true }).catch(() => null);
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }

        const url = new URL(req.url);
        const action = url.searchParams.get("action") || "chunk";
        if (action === "chunk") {
            return await handleChunk(req, session.user.id, url);
        }
        if (action === "complete") {
            return await handleComplete(req, session.user.id);
        }

        throw new SetVideoUploadError("上传动作参数错误", 400);
    } catch (error) {
        const status = error instanceof SetVideoUploadError ? error.status : 500;
        const message = error instanceof Error ? error.message : "服务器错误";
        console.error("[upload-set-video-chunk] failed:", error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message,
            data: null,
        }, { status });
    }
}
