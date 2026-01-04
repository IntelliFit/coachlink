import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import type {
    RespondRequestDto,
    RespondRequestResponseDto,
} from "../../../friends/entity";

/**
 * POST /api/user/friends/respond
 *
 * 响应好友请求 (accept / reject / block)
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "未登录" }, {
                status: 401,
            });
        }

        const userId = session.user.id;
        const body = await request.json() as RespondRequestDto;
        const { friendshipId, action } = body;

        if (!friendshipId || !action) {
            return NextResponse.json(
                { success: false, message: "参数不完整" },
                { status: 400 },
            );
        }

        const validActions = ["accept", "reject", "block"];
        if (!validActions.includes(action)) {
            return NextResponse.json(
                { success: false, message: "无效的操作" },
                { status: 400 },
            );
        }

        // 状态映射
        const statusMap: Record<string, string> = {
            "accept": "accepted",
            "reject": "rejected",
            "block": "blocked",
        };
        const newStatus = statusMap[action];

        // 更新数据库
        // 必须确保当前用户是 addressee_id (被请求方)
        const { data, error } = await supabase
            .from("social_friendships")
            .update({
                status: newStatus,
                updated_at: new Date().toISOString(),
            })
            .eq("id", friendshipId)
            .eq("addressee_id", userId) // 安全检查: 只能处理发给自己的请求
            .select()
            .single();

        if (error) {
            console.error("Respond request error:", error);
            return NextResponse.json({ success: false, message: "操作失败" }, {
                status: 500,
            });
        }

        if (!data) {
            return NextResponse.json({
                success: false,
                message: "请求不存在或无权操作",
            }, { status: 404 });
        }

        return NextResponse.json<RespondRequestResponseDto>({
            success: true,
            data: { newStatus },
        });
    } catch (error) {
        console.error("Respond API error:", error);
        return NextResponse.json({ success: false, message: "服务器错误" }, {
            status: 500,
        });
    }
}
