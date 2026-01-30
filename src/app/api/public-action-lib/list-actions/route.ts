import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

import type { ApiData } from "@/types/api";
import type {
    ListPublicActionsDto,
    ListPublicActionsResponseDto,
    PublicActionContributorDto,
    PublicActionItemDto,
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

        const { page = 1, limit = 12, search, type } =
            (await req.json()) as ListPublicActionsDto;

        let query = supabase
            .from("community_actions")
            .select("*", { count: "exact" })
            .order("like_count", { ascending: false })
            .order("created_at", { ascending: false });

        if (type) {
            query = query.eq("type", type);
        }

        if (search) {
            const escaped = search.replace(/[%_]/g, "\\$&");
            query = query.or(
                `name.ilike.%${escaped}%,detail.ilike.%${escaped}%`,
            );
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to);

        const { data: rows, count, error } = await query;
        if (error) {
            console.error("[public-action-lib] list-actions error:", error);
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "获取公共动作列表失败", data: null },
                { status: 500 },
            );
        }

        const actions = (rows || []) as any[];
        const actionIds = Array.from(
            new Set(actions.map((a) => a.id).filter(Boolean)),
        );
        const actionNames = Array.from(
            new Set(actions.map((a) => a.name).filter(Boolean)),
        );
        const contributorIds = Array.from(
            new Set(actions.map((a) => a.contributor_user_id).filter(Boolean)),
        );

        // 1) isLiked
        let likedIds = new Set<string>();
        if (actionIds.length > 0) {
            const { data: likesData } = await supabase
                .from("community_action_likes")
                .select("action_id")
                .eq("user_id", userId)
                .in("action_id", actionIds);
            likedIds = new Set((likesData || []).map((x: any) => x.action_id));
        }

        // 2) isAdded (by name: aligns with existing unique constraint user_id+name)
        let addedNames = new Set<string>();
        if (actionNames.length > 0) {
            const { data: addedData } = await supabase
                .from("student_actions")
                .select("name")
                .eq("user_id", userId)
                .in("name", actionNames);
            addedNames = new Set((addedData || []).map((x: any) => x.name));
        }

        // 3) contributor profile
        const contributorMap = new Map<string, PublicActionContributorDto>();
        if (contributorIds.length > 0) {
            const { data: profilesData } = await supabase
                .from("user_profiles")
                .select("user_id, nickname, avatar_url")
                .in("user_id", contributorIds);
            for (const p of profilesData || []) {
                contributorMap.set(p.user_id, {
                    userId: p.user_id,
                    nickname: p.nickname ?? null,
                    avatarUrl: p.avatar_url ?? null,
                });
            }
        }

        const enriched: PublicActionItemDto[] = actions.map((a) => ({
            id: a.id,
            contributor_user_id: a.contributor_user_id,
            name: a.name,
            detail: a.detail ?? null,
            positions: a.positions ?? null,
            attrs: a.attrs ?? null,
            url: a.url ?? null,
            type: a.type ?? null,
            item_schema: a.item_schema ?? null,
            suggested_time: a.suggested_time ?? null,
            enableAutoWeightCompute:
                (a.enableAutoWeightCompute as boolean | undefined) ?? null,
            includesBodyWeight: (a.includesBodyWeight as boolean | undefined) ?? null,
            canonical_action_id: a.canonical_action_id ?? null,
            like_count: Number(a.like_count || 0),
            created_at: a.created_at ?? null,
            updated_at: a.updated_at ?? null,
            isLiked: likedIds.has(a.id),
            isAdded: addedNames.has(a.name),
            contributor: contributorMap.get(a.contributor_user_id) || null,
        }));

        return NextResponse.json<ApiData<ListPublicActionsResponseDto>>({
            success: true,
            message: "获取成功",
            data: {
                actions: enriched,
                totalCount: count || 0,
                page,
                limit,
            },
        });
    } catch (e) {
        console.error("[public-action-lib] list-actions unexpected:", e);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}

