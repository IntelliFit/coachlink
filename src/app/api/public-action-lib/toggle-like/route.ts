import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { filterReviewedStreetWorkoutActions } from "@/lib/streetWorkoutImageReview";

import type { ApiData } from "@/types/api";
import type {
    TogglePublicActionLikeDto,
    TogglePublicActionLikeResponseDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        const userId = session?.user?.id || null;
        if (!userId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "用户未登录", data: null },
                { status: 401 },
            );
        }

        const { actionId } = (await req.json()) as TogglePublicActionLikeDto;
        if (!actionId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "缺少 actionId", data: null },
                { status: 400 },
            );
        }

        const { data: action, error: actionError } = await supabase
            .from("community_actions")
            .select("id, like_count, name, detail, type, attrs, canonical_action_id, url")
            .eq("id", actionId)
            .single();

        if (actionError || !action || (await filterReviewedStreetWorkoutActions(supabase, [action])).length === 0) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "公共动作不存在", data: null },
                { status: 404 },
            );
        }

        const { data: existingLike } = await supabase
            .from("community_action_likes")
            .select("id")
            .eq("action_id", actionId)
            .eq("user_id", userId)
            .limit(1)
            .single();

        let liked = false;

        if (existingLike?.id) {
            const { error: delError } = await supabase
                .from("community_action_likes")
                .delete()
                .eq("id", existingLike.id);
            if (delError) {
                console.error("[public-action-lib] toggle-like delete error:", delError);
                return NextResponse.json<ApiData<null>>(
                    { success: false, message: "取消点赞失败", data: null },
                    { status: 500 },
                );
            }
            liked = false;
        } else {
            const { error: insError } = await supabase
                .from("community_action_likes")
                .insert({ action_id: actionId, user_id: userId } as any);
            if (insError) {
                console.error("[public-action-lib] toggle-like insert error:", insError);
                return NextResponse.json<ApiData<null>>(
                    { success: false, message: "点赞失败", data: null },
                    { status: 500 },
                );
            }
            liked = true;
        }

        // 读取最新 like_count（由触发器更新）
        const { data: updated } = await supabase
            .from("community_actions")
            .select("like_count")
            .eq("id", actionId)
            .single();

        const likeCount = Number((updated as any)?.like_count ?? 0);

        return NextResponse.json<ApiData<TogglePublicActionLikeResponseDto>>({
            success: true,
            message: liked ? "点赞成功" : "已取消点赞",
            data: { liked, likeCount },
        });
    } catch (e) {
        console.error("[public-action-lib] toggle-like unexpected:", e);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}

