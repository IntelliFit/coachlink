import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type { ApiData } from "@/types/api";
import type { ShareInfoResponseDto } from "./entity";
import { buildShareInfo } from "../share-helper";

/**
 * POST /api/execution/share-info
 *
 * 获取训练打卡卡片所需的数据（用于前端分享卡片）
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<ShareInfoResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }

        const userId = session.user.id;
        const body = await req.json() as { id: string };
        const { id: executionId } = body;

        if (!executionId) {
            return NextResponse.json<ApiData<ShareInfoResponseDto>>({
                success: false,
                message: "缺少执行ID",
                data: null,
            }, { status: 400 });
        }

        const result = await buildShareInfo(executionId, userId);
        return NextResponse.json<ApiData<ShareInfoResponseDto>>(result.body, {
            status: result.status,
        });
    } catch (error) {
        console.error("获取分享信息失败:", error);
        return NextResponse.json<ApiData<ShareInfoResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}

