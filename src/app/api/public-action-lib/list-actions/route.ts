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
        // 允许未登录用户访问公共动作列表

        const { page = 1, limit = 12, search, type, viewerActionType = "student" } =
            (await req.json()) as ListPublicActionsDto;

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const buildQuery = (tableName: "community_actions_ranked" | "community_actions") => {
            let query = supabase
                .from(tableName)
                .select("*", { count: "exact" });

            if (tableName === "community_actions_ranked") {
                query = query
                    .order("rank_score", { ascending: false })
                    .order("like_count", { ascending: false });
            } else {
                query = query.order("like_count", { ascending: false });
            }

            query = query
                .order("created_at", { ascending: false })
                .order("id", { ascending: true });

            if (type) {
                query = query.eq("type", type);
            }

            if (search) {
                const escaped = search.replace(/[%_]/g, "\\$&");
                query = query.or(
                    `name.ilike.%${escaped}%,detail.ilike.%${escaped}%`,
                );
            }

            return query.range(from, to);
        };

        let { data: rows, count, error } = await buildQuery("community_actions_ranked");
        if (error) {
            console.warn(
                "[public-action-lib] list-actions ranked view failed, fallback:",
                error,
            );
            ({ data: rows, count, error } = await buildQuery("community_actions"));
        }

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
        const canonicalIds = Array.from(
            new Set(actions.map((a) => a.canonical_action_id).filter(Boolean)),
        );

        // 1) isLiked - 仅在用户已登录时查询
        let likedIds = new Set<string>();
        if (userId && actionIds.length > 0) {
            const { data: likesData } = await supabase
                .from("community_action_likes")
                .select("action_id")
                .eq("user_id", userId)
                .in("action_id", actionIds);
            likedIds = new Set((likesData || []).map((x: any) => x.action_id));
        }

        // 2) isAdded (by name: aligns with existing unique constraint) - 仅在用户已登录时查询
        let addedNames = new Set<string>();
        if (userId && actionNames.length > 0) {
            const targetTable =
                viewerActionType === "coach" ? "coach_actions" : "student_actions";
            const ownerColumn =
                viewerActionType === "coach" ? "coach_id" : "user_id";

            const { data: addedData } = await supabase
                .from(targetTable)
                .select("name")
                .eq(ownerColumn, userId)
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

        // 4) canonical action reference media
        const canonicalReferenceImageMap = new Map<string, string | null>();
        const canonicalReferenceAnimationMap = new Map<string, string | null>();
        if (canonicalIds.length > 0) {
            const { data: canonicalRows, error: canonicalError } = await supabase
                .from("canonical_actions")
                .select("id, reference_image_url, reference_animation_url")
                .in("id", canonicalIds);
            if (canonicalError) {
                console.warn("[public-action-lib] load canonical reference images failed:", canonicalError);
            }
            for (const row of canonicalRows || []) {
                canonicalReferenceImageMap.set(row.id, row.reference_image_url ?? null);
                canonicalReferenceAnimationMap.set(row.id, row.reference_animation_url ?? null);
            }
        }

        const enriched: PublicActionItemDto[] = actions.map((a) => ({
            id: a.id,
            contributor_user_id: a.contributor_user_id,
            owner_user_id: a.owner_user_id ?? null,
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
            reference_image_url:
                a.canonical_action_id
                    ? canonicalReferenceImageMap.get(a.canonical_action_id) ?? null
                    : null,
            reference_animation_url:
                a.canonical_action_id
                    ? canonicalReferenceAnimationMap.get(a.canonical_action_id) ?? null
                    : null,
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
