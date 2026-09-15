import { NextResponse } from "next/server";
import { getApiUserId } from "@/lib/getApiUserId";
import { buildDatedKey, cosUpload } from "@/lib/cos";
import type { ApiData } from "@/types/api";
import type { UploadSetVideoResponseDto } from "./entity";
import {
    prepareSetVideoUpload,
    persistSetVideoUpload,
    SetVideoUploadError,
} from "../_helpers/setVideoUpload";

export const runtime = "nodejs";
export const maxDuration = 300;
export const preferredRegion = "auto";

/**
 * POST /api/execution/upload-set-video
 *
 * 上传组视频。小程序大文件会走分片接口；这里保留给 Web 和小文件 multipart。
 */
export async function POST(req: Request) {
    try {
        const userId = await getApiUserId(req);
        if (!userId) {
            return NextResponse.json<ApiData<UploadSetVideoResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const executionId = String(formData.get("executionId") || "");
        const actionId = String(formData.get("actionId") || "");
        const setNumber = formData.get("setNumber");

        if (!file) {
            return NextResponse.json<ApiData<UploadSetVideoResponseDto>>({
                success: false,
                message: "缺少视频文件",
                data: null,
            }, { status: 400 });
        }

        const prepared = await prepareSetVideoUpload({
            userId,
            executionId,
            actionId,
            setNumber,
            fileSizeBytes: file.size,
        });

        const ext = file.name.split(".").pop() || "mp4";
        const storagePath = buildDatedKey(ext, userId, "executions");
        const bytes = new Uint8Array(await file.arrayBuffer());
        const uploaded = await cosUpload("videos", storagePath, bytes, {
            contentType: file.type || "application/octet-stream",
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
    } catch (error) {
        const status = error instanceof SetVideoUploadError ? error.status : 500;
        const message = error instanceof Error ? error.message : "服务器错误";
        console.error("[upload-set-video] failed:", error);
        return NextResponse.json<ApiData<UploadSetVideoResponseDto>>({
            success: false,
            message,
            data: null,
        }, { status });
    }
}
