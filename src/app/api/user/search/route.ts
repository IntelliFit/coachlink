import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getApiUserId } from "@/lib/getApiUserId";
import type {
    SearchUserRequestDto,
    SearchUserResponseDto,
} from "../../friends/entity";

/**
 * GET /api/user/search?query={nickname_or_id}
 *
 * 精确搜索用户（按昵称或搜索ID）
 * 支持 NextAuth Session（网页）或 Authorization: Bearer JWT（小程序）
 */
export async function GET(request: NextRequest) {
    try {
        const currentUserId = await getApiUserId(request);
        if (!currentUserId) {
            return NextResponse.json({ success: false, message: "未登录" }, {
                status: 401,
            });
        }
        const { searchParams } = new URL(request.url);
        const query = searchParams.get("query")?.trim();

        if (!query) {
            return NextResponse.json({
                success: false,
                message: "请输入搜索关键词",
            }, { status: 400 });
        }

        // 1. 搜索用户 (昵称完全匹配 OR search_id 完全匹配)
        // 排除自己
        const { data: users, error } = await supabase
            .from("user_profiles")
            .select("user_id, nickname, avatar_url, search_id")
            .or(`nickname.eq.${query},search_id.eq.${query}`)
            .neq("user_id", currentUserId)
            .limit(10);

        if (error) {
            console.error("Search users error:", error);
            return NextResponse.json({ success: false, message: "搜索失败" }, {
                status: 500,
            });
        }

        if (!users || users.length === 0) {
            return NextResponse.json<SearchUserResponseDto>({
                success: true,
                data: [], // 没有找到
            });
        }

        // 2. 将 snake_case 转换为驼峰，适配 DTO
        const result = users.map((user) => ({
            id: user.user_id,
            nickname: user.nickname,
            avatarUrl: user.avatar_url,
            searchId: user.search_id,
        }));

        return NextResponse.json<SearchUserResponseDto>({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error("Search API error:", error);
        return NextResponse.json({ success: false, message: "服务器错误" }, {
            status: 500,
        });
    }
}
