import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getApiUserId } from "@/lib/getApiUserId";

/**
 * DELETE /api/user/friends/[friendId]
 *
 * 删除好友（解出关系，或取消已发送的请求）
 * friendId 是用户的 ID，不是 relationship ID
 * 支持 NextAuth Session（网页）或 Authorization: Bearer JWT（小程序）
 */
export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ friendId: string }> },
) {
    try {
        const userId = await getApiUserId(request);
        if (!userId) {
            return NextResponse.json({ success: false, message: "未登录" }, {
                status: 401,
            });
        }
        // Await the params
        const params = await context.params;
        const friendId = params.friendId;

        if (!friendId) {
            return NextResponse.json({ success: false, message: "参数错误" }, {
                status: 400,
            });
        }

        // 删除涉及两人的关系 (无论谁是 requester)
        const { error } = await supabase
            .from("social_friendships")
            .delete()
            .or(`and(requester_id.eq.${userId},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${userId})`);

        if (error) {
            console.error("Remove friend error:", error);
            return NextResponse.json({ success: false, message: "删除失败" }, {
                status: 500,
            });
        }

        return NextResponse.json({
            success: true,
            message: "已删除好友",
        });
    } catch (error) {
        console.error("Remove friend API error:", error);
        return NextResponse.json({ success: false, message: "服务器错误" }, {
            status: 500,
        });
    }
}
