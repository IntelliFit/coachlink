import { NextResponse } from "next/server";
import { cosUpload, buildDatedKey } from "@/lib/cos";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

import type { ApiData } from "@/types/api";
import type { UploadQuestionMediaResponseDto } from "./entity";

export const runtime = "nodejs";
export const maxDuration = 300;
export const preferredRegion = "auto";

const BUCKET = "videos";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB

export async function POST(req: Request) {
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
                { success: false, message: "仅教练可上传问卷示例媒体", data: null },
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

        const isImage = file.type?.startsWith("image/");
        const isVideo = file.type?.startsWith("video/");
        if (!isImage && !isVideo) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "仅支持上传图片或视频文件", data: null },
                { status: 400 },
            );
        }

        const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
        if (file.size > maxBytes) {
            return NextResponse.json<ApiData<null>>(
                {
                    success: false,
                    message: isImage
                        ? "图片过大，单张图片请小于 5MB"
                        : "视频过大，单个视频请小于 200MB",
                    data: null,
                },
                { status: 413 },
            );
        }

        const ext = (file.name.split(".").pop() || (isImage ? "png" : "mp4")).toLowerCase();
        const filePath = buildDatedKey(ext, userId, "questionnaire-media");

        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        const { url } = await cosUpload(BUCKET, filePath, uint8Array, {
            contentType: file.type || "application/octet-stream",
        });

        const resp: UploadQuestionMediaResponseDto = {
            url,
            storage_bucket: BUCKET,
            storage_path: filePath,
        };

        return NextResponse.json<ApiData<UploadQuestionMediaResponseDto>>({
            success: true,
            message: "上传成功",
            data: resp,
        });
    } catch (err) {
        console.error("[upload-question-media] unexpected error:", err);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}

