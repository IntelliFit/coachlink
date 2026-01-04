import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import type { PendingRequestsResponseDto } from "../../../friends/entity";

/**
 * GET /api/user/friends/pending
 *
 * 获取收到的待处理好友请求
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "未登录" }, {
                status: 401,
            });
        }

        const userId = session.user.id;

        // 1. 查询待处理请求 (只获取 requester_id)
        const { data: requests, error } = await supabase
            .from("social_friendships")
            .select(`
                id,
                created_at,
                requester_id
            `)
            .eq("addressee_id", userId)
            .eq("status", "pending")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Get pending requests error:", error);
            return NextResponse.json({
                success: false,
                message: "获取好友请求失败",
            }, { status: 500 });
        }

        if (!requests || requests.length === 0) {
            return NextResponse.json<PendingRequestsResponseDto>({
                success: true,
                data: { requests: [], total: 0 },
            });
        }

        // 2. 批量获取 requester de user_profile
        const requesterIds = requests.map((r: any) => r.requester_id);
        const { data: profiles, error: profileError } = await supabase
            .from("user_profiles")
            .select("user_id, nickname, avatar_url")
            .in("user_id", requesterIds);

        if (profileError) {
            console.error("Get profiles error:", profileError);
            // 不中断，只是没头像
        }

        const profileMap = new Map();
        if (profiles) {
            profiles.forEach((p: any) => profileMap.set(p.user_id, p));
        }

        // 3. 组装数据
        const formattedRequests = requests.map((r: any) => {
            const profile = profileMap.get(r.requester_id) || {};
            return {
                friendshipId: r.id,
                requester: {
                    userId: r.requester_id,
                    nickname: profile.nickname || "未知用户",
                    avatarUrl: profile.avatar_url,
                },
                createdAt: r.created_at,
                message: "请求添加你为好友",
            };
        });

        return NextResponse.json<PendingRequestsResponseDto>({
            success: true,
            data: {
                requests: formattedRequests,
                total: formattedRequests.length,
            },
        });
    } catch (error) {
        console.error("Get pending requests API error:", error);
        return NextResponse.json({ success: false, message: "服务器错误" }, {
            status: 500,
        });
    }
}
