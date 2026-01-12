import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { v4 as uuidv4 } from "uuid";

import type { ApiData } from "@/types/api";
import type { UploadDemoVideoResponseDto } from "./entity";

// 运行在 Node.js，以避免 Edge 运行时的流式限制
export const runtime = "nodejs";
export const maxDuration = 300;
export const preferredRegion = "auto";

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

        const maxSizeBytes = 100 * 1024 * 1024; // 100MB
        if (file.size > maxSizeBytes) {
            return NextResponse.json<ApiData<null>>(
                {
                    success: false,
                    message: "视频过大，单个视频请小于 100MB",
                    data: null,
                },
                { status: 413 },
            );
        }

        const ext = file.name.split(".").pop() || "mp4";
        const safeName = `${Date.now()}-${uuidv4()}.${ext}`;
        const filePath = `${userId}/coach-actions/${safeName}`;

        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        const { error: uploadError } = await supabase.storage
            .from("videos")
            .upload(filePath, uint8Array, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            console.error("上传教练动作演示视频失败:", uploadError);
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "上传失败", data: null },
                { status: 500 },
            );
        }

        const {
            data: { publicUrl },
        } = supabase.storage.from("videos").getPublicUrl(filePath);

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
        console.error("上传教练动作演示视频失败:", err);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}

