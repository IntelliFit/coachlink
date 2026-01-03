import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import type { ShareInfoResponseDto } from "../entity";
import { buildShareInfo } from "../share-helper";

/**
 * GET /api/execution/share-info?id={executionId}
 *
 * 获取训练打卡卡片所需的数据（用于前端分享卡片）
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json<ShareInfoResponseDto>(
                { success: false, message: "未登录" },
                { status: 401 },
            );
        }

        const userId = session.user.id;
        const { searchParams } = new URL(request.url);
        const executionId = searchParams.get("id");

        if (!executionId) {
            return NextResponse.json<ShareInfoResponseDto>(
                { success: false, message: "缺少执行ID" },
                { status: 400 },
            );
        }

        const result = await buildShareInfo(executionId, userId);
        return NextResponse.json<ShareInfoResponseDto>(result.body, {
            status: result.status,
        });
    } catch (error) {
        console.error("获取分享信息失败:", error);
        return NextResponse.json<ShareInfoResponseDto>(
            { success: false, message: "服务器错误" },
            { status: 500 },
        );
    }
}

