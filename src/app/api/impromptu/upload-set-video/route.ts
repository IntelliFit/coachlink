import { NextResponse } from "next/server";
import { getApiUserId } from "@/lib/getApiUserId";
import { buildDatedKey, cosUpload } from "@/lib/cos";
import type { ApiData } from "@/types/api";
import {
    ImpromptuSetVideoError,
    persistImpromptuSetVideo,
    prepareImpromptuSetVideo,
    type ImpromptuSetVideoResponse,
} from "../_helpers/setVideoUpload";

export const runtime = "nodejs";
export const maxDuration = 300;
export const preferredRegion = "auto";

export async function POST(req: Request) {
    try {
        const userId = await getApiUserId(req);
        if (!userId) {
            return NextResponse.json<ApiData<ImpromptuSetVideoResponse>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }

        if (
            !process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY &&
            !process.env.SUPABASE_SERVICE_ROLE_KEY
        ) {
            return NextResponse.json<ApiData<ImpromptuSetVideoResponse>>({
                success: false,
                message: "服务器配置缺失，暂时无法保存视频",
                data: null,
            }, { status: 500 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        if (!file) {
            return NextResponse.json<ApiData<ImpromptuSetVideoResponse>>({
                success: false,
                message: "缺少视频文件",
                data: null,
            }, { status: 400 });
        }

        const prepared = await prepareImpromptuSetVideo({
            userId,
            executionId: String(formData.get("executionId") || ""),
            actionId: String(formData.get("actionId") || "") || null,
            actionIndex: formData.get("actionIndex"),
            setNumber: formData.get("setNumber"),
            fileSizeBytes: file.size,
        });
        const ext = file.name.split(".").pop() || "mp4";
        const storagePath = buildDatedKey(ext, userId, "impromptu-executions");
        const uploaded = await cosUpload(
            "videos",
            storagePath,
            new Uint8Array(await file.arrayBuffer()),
            { contentType: file.type || "application/octet-stream" },
        );
        const data = await persistImpromptuSetVideo({
            prepared,
            videoUrl: uploaded.url,
            storagePath,
        });

        return NextResponse.json<ApiData<ImpromptuSetVideoResponse>>({
            success: true,
            message: "上传视频成功",
            data,
        });
    } catch (error) {
        const status = error instanceof ImpromptuSetVideoError ? error.status : 500;
        const message = error instanceof Error ? error.message : "服务器错误";
        console.error("[impromptu/upload-set-video] failed:", error);
        return NextResponse.json<ApiData<ImpromptuSetVideoResponse>>({
            success: false,
            message,
            data: null,
        }, { status });
    }
}
