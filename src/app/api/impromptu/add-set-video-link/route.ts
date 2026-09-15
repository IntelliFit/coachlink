import { NextResponse } from "next/server";
import { getApiUserId } from "@/lib/getApiUserId";
import type { ApiData } from "@/types/api";
import {
    ImpromptuSetVideoError,
    persistImpromptuSetVideo,
    prepareImpromptuSetVideo,
    type ImpromptuSetVideoResponse,
} from "../_helpers/setVideoUpload";

type AddImpromptuSetVideoLinkBody = {
    executionId?: string;
    actionId?: string | null;
    actionIndex?: number;
    setNumber?: number;
    videoUrl?: string;
};

function isHttpUrl(value: string) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
    } catch {
        return false;
    }
}

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
                message: "服务器配置缺失，暂时无法保存视频链接",
                data: null,
            }, { status: 500 });
        }

        const body = (await req.json()) as AddImpromptuSetVideoLinkBody;
        const videoUrl = String(body.videoUrl || "").trim();
        if (!isHttpUrl(videoUrl)) {
            return NextResponse.json<ApiData<ImpromptuSetVideoResponse>>({
                success: false,
                message: "视频链接需以 http:// 或 https:// 开头",
                data: null,
            }, { status: 400 });
        }

        const prepared = await prepareImpromptuSetVideo({
            userId,
            executionId: String(body.executionId || ""),
            actionId: body.actionId,
            actionIndex: body.actionIndex,
            setNumber: body.setNumber,
            fileSizeBytes: 0,
            external: true,
        });
        const actionKey = prepared.actionId || `action-${prepared.actionIndex}`;
        const storagePath =
            `external/${userId}/impromptu-executions/${prepared.executionId}/${actionKey}/${prepared.setNumber}`;
        const data = await persistImpromptuSetVideo({
            prepared,
            videoUrl,
            storagePath,
            storageBucket: "external",
        });

        return NextResponse.json<ApiData<ImpromptuSetVideoResponse>>({
            success: true,
            message: "添加视频链接成功",
            data,
        });
    } catch (error) {
        const status = error instanceof ImpromptuSetVideoError ? error.status : 500;
        const message = error instanceof Error ? error.message : "服务器错误";
        console.error("[impromptu/add-set-video-link] failed:", error);
        return NextResponse.json<ApiData<ImpromptuSetVideoResponse>>({
            success: false,
            message,
            data: null,
        }, { status });
    }
}
