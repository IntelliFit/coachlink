import { NextResponse } from "next/server";
import { cosUpload, buildDatedKey } from "@/lib/cos";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

import type { ApiData } from "@/types/api";
import type { UploadDemoVideoResponseDto } from "./entity";

function getRequestId(req: Request) {
    return (
        req.headers.get("x-request-id") ||
        req.headers.get("x-vercel-id") ||
        crypto.randomUUID()
    );
}

// 运行在 Node.js，以避免 Edge 运行时的流式限制
export const runtime = "nodejs";
export const maxDuration = 300;
export const preferredRegion = "auto";

export async function POST(req: Request) {
    const requestId = getRequestId(req);
    try {
        const session = await getServerSession();
        const userId = session?.user?.id || null;

        if (!userId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "用户未登录", data: null },
                { status: 401 },
            );
        }

        if (!session?.user?.is_coach) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "Forbidden", data: null },
                { status: 403 },
            );
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "缺少文件", data: null },
                { status: 400 },
            );
        }

        if (!file.type?.startsWith("video/")) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "仅支持上传视频文件", data: null },
                { status: 400 },
            );
        }

        const maxSizeBytes = 200 * 1024 * 1024; // 200MB
        if (file.size > maxSizeBytes) {
            return NextResponse.json<ApiData<null>>(
                {
                    success: false,
                    message: "视频过大，单个视频请小于 200MB",
                    data: null,
                },
                { status: 413 },
            );
        }

        const ext = file.name.split(".").pop() || "mp4";
        const filePath = buildDatedKey(ext, userId, "coach-actions");

        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        let publicUrl: string;
        try {
            const uploaded = await cosUpload("videos", filePath, uint8Array, {
                contentType: file.type,
            });
            publicUrl = uploaded.url;
        } catch (uploadError: any) {
            console.error("上传教练动作演示视频失败:", uploadError);
            return NextResponse.json<ApiData<null>>(
                {
                    success: false,
                    message: uploadError?.message || "上传失败",
                    data: null,
                },
                { status: 500 },
            );
        }

        return NextResponse.json<ApiData<UploadDemoVideoResponseDto>>({
            success: true,
            message: "上传成功",
            data: {
                url: publicUrl,
                storage_bucket: "videos",
                storage_path: filePath,
            },
        });
    } catch (err) {
        console.error(`[upload-demo-video][${requestId}] 上传教练动作演示视频失败:`, err);
        const errorMessage = err instanceof Error ? err.message : "服务器错误";
        return NextResponse.json<ApiData<null>>(
            { success: false, message: errorMessage, data: null },
            { status: 500 },
        );
    }
}

