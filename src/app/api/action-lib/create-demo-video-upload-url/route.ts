import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { v4 as uuidv4 } from "uuid";
import type { ApiData } from "@/types/api";
import type {
    CreateDemoVideoUploadUrlDto,
    CreateDemoVideoUploadUrlResponseDto,
} from "./entity";

export const runtime = "nodejs";
export const maxDuration = 60;
export const preferredRegion = "auto";

export async function POST(req: Request) {
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

    if (
        !process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY &&
        !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
        console.error(
            "[create-demo-video-upload-url] Missing service role key env. Expect one of NEXT_SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE_KEY.",
        );
        return NextResponse.json<ApiData<null>>(
            {
                success: false,
                message:
                    "服务器配置缺失：未设置 Supabase Service Role Key，无法创建上传链接",
                data: null,
            },
            { status: 500 },
        );
    }

    let body: CreateDemoVideoUploadUrlDto;
    try {
        body = (await req.json()) as CreateDemoVideoUploadUrlDto;
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

    // 动作演示视频：和 UI 文案一致，限制 100MB
    const maxSizeBytes = 100 * 1024 * 1024;
    if (fileSizeBytes > maxSizeBytes) {
        return NextResponse.json<ApiData<null>>(
            {
                success: false,
                message: "视频过大，单个视频请小于 100MB",
                data: null,
            },
            { status: 413 },
        );
    }

    const ext = (originalFilename.split(".").pop() || "mp4").toLowerCase();
    const safeName = `${Date.now()}-${uuidv4()}.${ext}`;
    const path = `${userId}/coach-actions/${safeName}`;

    const { data: signed, error: signedError } = await supabase.storage
        .from("videos")
        .createSignedUploadUrl(path, { upsert: false });

    if (signedError || !signed?.token) {
        console.error("[create-demo-video-upload-url] Failed:", signedError);
        return NextResponse.json<ApiData<null>>(
            {
                success: false,
                message: signedError?.message || "创建上传链接失败",
                data: null,
            },
            { status: 500 },
        );
    }

    const {
        data: { publicUrl },
    } = supabase.storage.from("videos").getPublicUrl(path);

    const resp: CreateDemoVideoUploadUrlResponseDto = {
        bucket: "videos",
        path,
        token: signed.token,
        publicUrl,
    };

    return NextResponse.json<ApiData<CreateDemoVideoUploadUrlResponseDto>>({
        success: true,
        message: "创建上传链接成功",
        data: resp,
    });
}

