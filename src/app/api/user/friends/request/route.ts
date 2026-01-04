import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import type {
    FriendRequestDto,
    FriendRequestResponseDto,
} from "../../../friends/entity";

/**
 * POST /api/user/friends/request
 *
 * 发送好友请求
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "未登录" }, {
                status: 401,
            });
        }

        const requesterId = session.user.id;
        const body = await request.json() as FriendRequestDto;
        const { targetUserId, message } = body;

        if (!targetUserId) {
            return NextResponse.json({
                success: false,
                message: "目标用户ID不能为空",
            }, { status: 400 });
        }

        if (requesterId === targetUserId) {
            return NextResponse.json({
                success: false,
                message: "不能添加自己为好友",
            }, { status: 400 });
        }

        // 1. 检查是否已经是好友 或 已经发送过请求
        // 查询双向关系
        const { data: existing, error: checkError } = await supabase
            .from("social_friendships")
            .select("id, status, requester_id, addressee_id")
            .or(`and(requester_id.eq.${requesterId},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${requesterId})`)
            .single();

        if (checkError && checkError.code !== "PGRST116") { // PGRST116 is "no rows returned"
            console.error("Check friendship error:", checkError);
            return NextResponse.json({
                success: false,
                message: "检查好友状态失败",
            }, { status: 500 });
        }

        if (existing) {
            if (existing.status === "accepted") {
                return NextResponse.json<FriendRequestResponseDto>({
                    success: true,
                    data: {
                        friendshipId: existing.id,
                        status: "already_friends",
                    },
                    message: "你们已经是好友了",
                });
            }

            if (existing.status === "blocked") {
                return NextResponse.json({
                    success: false,
                    message: "无法发送请求",
                }, { status: 403 });
            }

            // 如果已经有 pending 请求
            if (existing.status === "pending") {
                if (existing.requester_id === requesterId) {
                    return NextResponse.json<FriendRequestResponseDto>({
                        success: true,
                        data: {
                            friendshipId: existing.id,
                            status: "already_requested",
                        },
                        message: "已发送过请求，请等待对方通过",
                    });
                } else {
                    // 对方发过请求给我，直接接受
                    const { error: updateError } = await supabase
                        .from("social_friendships")
                        .update({
                            status: "accepted",
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", existing.id);

                    if (updateError) throw updateError;

                    return NextResponse.json<FriendRequestResponseDto>({
                        success: true,
                        data: { friendshipId: existing.id, status: "accepted" },
                        message: "对方也请求添加你为好友，已自动通过",
                    });
                }
            }
        }

        // 2. 创建新请求
        const { data: newFriendship, error: insertError } = await supabase
            .from("social_friendships")
            .insert({
                requester_id: requesterId,
                addressee_id: targetUserId,
                status: "pending",
            })
            .select("id")
            .single();

        if (insertError) {
            console.error("Insert friendship error:", insertError);
            return NextResponse.json({
                success: false,
                message: "发送请求失败",
            }, { status: 500 });
        }

        return NextResponse.json<FriendRequestResponseDto>({
            success: true,
            data: { friendshipId: newFriendship.id, status: "pending" },
            message: "好友请求已发送",
        });
    } catch (error) {
        console.error("Friend request API error:", error);
        return NextResponse.json({ success: false, message: "服务器错误" }, {
            status: 500,
        });
    }
}
