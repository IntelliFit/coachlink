import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { cosPresignedPutUrl, buildDatedKey } from "@/lib/cos";
import type { ApiData } from "@/types/api";
import type {
    CreateVideoUploadUrlDto,
    CreateVideoUploadUrlResponseDto,
} from "./entity";

export const runtime = "nodejs";
export const maxDuration = 60;
export const preferredRegion = "auto";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "用户未登录", data: null },
            { status: 401 },
        );
    }

    const userId = session.user.id;

    let body: CreateVideoUploadUrlDto;
    try {
        body = (await req.json()) as CreateVideoUploadUrlDto;
    } catch {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "请求参数错误", data: null },
            { status: 400 },
        );
    }

    const { originalFilename, contentType, fileSizeBytes } = body || ({} as any);

    if (!originalFilename || !contentType || !fileSizeBytes) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "缺少必要参数", data: null },
            { status: 400 },
        );
    }

    if (!contentType.startsWith("video/")) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "仅支持上传视频文件", data: null },
            { status: 400 },
        );
    }

    // 统一限制：直传也限制 200MB（可按你业务再调大）
    const maxSizeBytes = 200 * 1024 * 1024;
    if (fileSizeBytes > maxSizeBytes) {
        return NextResponse.json<ApiData<null>>(
            {
                success: false,
                message: "视频过大，单个视频请小于 200MB",
                data: null,
            },
            { status: 413 },
        );
    }

    // 配额检查（不在这里扣费，避免失败也扣；实际扣费在“提交视频记录”时做）
    const { checkStorageAvailable } = await import("@/lib/membershipLimit");
    const quotaCheck = await checkStorageAvailable(userId, fileSizeBytes);
    if (!quotaCheck.success) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: quotaCheck.message || "存储空间不足", data: null },
            { status: 403 },
        );
    }

    const ext = (originalFilename.split(".").pop() || "mp4").toLowerCase();
    const path = buildDatedKey(ext, userId);

    let uploadUrl: string;
    let publicUrl: string;
    try {
        const signed = await cosPresignedPutUrl("videos", path, {
            contentType,
            expiresSec: 3600,
        });
        uploadUrl = signed.uploadUrl;
        publicUrl = signed.url;
    } catch (e: any) {
        console.error("[create-video-upload-url] Failed:", e);
        return NextResponse.json<ApiData<null>>(
            {
                success: false,
                message: e?.message || "创建上传链接失败",
                data: null,
            },
            { status: 500 },
        );
    }

    const resp: CreateVideoUploadUrlResponseDto = {
        bucket: "videos",
        path,
        token: "",
        publicUrl,
        uploadUrl,
    };

    return NextResponse.json<ApiData<CreateVideoUploadUrlResponseDto>>({
        success: true,
        message: "创建上传链接成功",
        data: resp,
    });
}

