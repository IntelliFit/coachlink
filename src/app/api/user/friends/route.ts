import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getApiUserId } from "@/lib/getApiUserId";
import type { FriendsListResponseDto } from "../../friends/entity";

/**
 * GET /api/user/friends
 *
 * 获取当前用户的好友列表 (status = 'accepted')
 * 支持 NextAuth Session（网页）或 Authorization: Bearer JWT（小程序）
 */
export async function GET(request: NextRequest) {
    try {
        const userId = await getApiUserId(request);
        if (!userId) {
            return NextResponse.json({ success: false, message: "未登录" }, {
                status: 401,
            });
        }

        // 1. 获取所有 accepted 的记录，包含 requester 和 addressee 两个方向
        const { data: friendships, error } = await supabase
            .from("social_friendships")
            .select(`
                id,
                updated_at,
                requester_id,
                addressee_id
            `)
            .eq("status", "accepted")
            .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
            .order("updated_at", { ascending: false });

        if (error) {
            console.error("Get friends error:", error);
            return NextResponse.json({
                success: false,
                message: "获取好友列表失败",
            }, { status: 500 });
        }

        if (!friendships || friendships.length === 0) {
            return NextResponse.json<FriendsListResponseDto>({
                success: true,
                data: { friends: [], total: 0 },
            });
        }

        // 2. 收集所有对方的 ID
        const friendIds = friendships.map((f: any) =>
            f.requester_id === userId ? f.addressee_id : f.requester_id
        );

        // 3. 批量获取用户信息
        const { data: profiles, error: profileError } = await supabase
            .from("user_profiles")
            .select("user_id, nickname, avatar_url")
            .in("user_id", friendIds);

        if (profileError) {
            console.error("Get profiles error:", profileError);
        }

        const profileMap = new Map();
        if (profiles) {
            profiles.forEach((p: any) => profileMap.set(p.user_id, p));
        }

        // 4. 组装数据
        const friends = friendships.map((f: any) => {
            const friendId = f.requester_id === userId
                ? f.addressee_id
                : f.requester_id;
            const friendProfile = profileMap.get(friendId) || {};

            return {
                userId: friendId,
                nickname: friendProfile.nickname || "未知用户",
                avatarUrl: friendProfile.avatar_url,
                friendsSince: f.updated_at,
            };
        });

        return NextResponse.json<FriendsListResponseDto>({
            success: true,
            data: {
                friends: friends,
                total: friends.length,
            },
        });
    } catch (error) {
        console.error("Get friends API error:", error);
        return NextResponse.json({ success: false, message: "服务器错误" }, {
            status: 500,
        });
    }
}
