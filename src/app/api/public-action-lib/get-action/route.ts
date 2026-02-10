import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

import type { ApiData } from "@/types/api";
import type {
    GetPublicActionDto,
    GetPublicActionResponseDto,
} from "./entity";
import type { PublicActionContributorDto, PublicActionItemDto } from "../list-actions/entity";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        const userId = session?.user?.id || null;
        // 允许未登录用户访问公共动作详情

        const { actionId, viewerActionType = "student" } =
            (await req.json()) as GetPublicActionDto;
        if (!actionId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "缺少 actionId", data: null },
                { status: 400 },
            );
        }

        const fetchFrom = async (tableName: "community_actions_ranked" | "community_actions") => {
            return supabase
                .from(tableName)
                .select("*")
                .eq("id", actionId)
                .single();
        };

        let { data: row, error } = await fetchFrom("community_actions_ranked");
        if (error) {
            console.warn("[public-action-lib] get-action ranked view failed, fallback:", error);
            ({ data: row, error } = await fetchFrom("community_actions"));
        }
        if (error || !row) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "公共动作不存在", data: null },
                { status: 404 },
            );
        }

        const action = row as any;

        // isLiked - 仅在用户已登录时查询
        let isLiked = false;
        if (userId) {
            const { data: likesData } = await supabase
                .from("community_action_likes")
                .select("action_id")
                .eq("user_id", userId)
                .eq("action_id", actionId);
            isLiked = (likesData || []).length > 0;
        }

        // isAdded - 仅在用户已登录时查询
        let isAdded = false;
        if (userId) {
            const targetTable =
                viewerActionType === "coach" ? "coach_actions" : "student_actions";
            const ownerColumn =
                viewerActionType === "coach" ? "coach_id" : "user_id";
            const { data: addedData } = await supabase
                .from(targetTable)
                .select("name")
                .eq(ownerColumn, userId)
                .eq("name", action.name)
                .maybeSingle();
            isAdded = !!addedData;
        }

        const contributorMap = new Map<string, PublicActionContributorDto>();
        if (action.contributor_user_id) {
            const { data: profilesData } = await supabase
                .from("user_profiles")
                .select("user_id, nickname, avatar_url")
                .eq("user_id", action.contributor_user_id);
            for (const p of profilesData || []) {
                contributorMap.set(p.user_id, {
                    userId: p.user_id,
                    nickname: p.nickname ?? null,
                    avatarUrl: p.avatar_url ?? null,
                });
            }
        }

        const enriched: PublicActionItemDto = {
            id: action.id,
            contributor_user_id: action.contributor_user_id,
            owner_user_id: action.owner_user_id ?? null,
            name: action.name,
            detail: action.detail ?? null,
            positions: action.positions ?? null,
            attrs: action.attrs ?? null,
            url: action.url ?? null,
            type: action.type ?? null,
            item_schema: action.item_schema ?? null,
            suggested_time: action.suggested_time ?? null,
            enableAutoWeightCompute:
                (action.enableAutoWeightCompute as boolean | undefined) ?? null,
            includesBodyWeight:
                (action.includesBodyWeight as boolean | undefined) ?? null,
            canonical_action_id: action.canonical_action_id ?? null,
            like_count: Number(action.like_count || 0),
            created_at: action.created_at ?? null,
            updated_at: action.updated_at ?? null,
            isLiked,
            isAdded,
            contributor: contributorMap.get(action.contributor_user_id) || null,
        };

        return NextResponse.json<ApiData<GetPublicActionResponseDto>>({
            success: true,
            message: "获取成功",
            data: { action: enriched },
        });
    } catch (e) {
        console.error("[public-action-lib] get-action unexpected:", e);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}

