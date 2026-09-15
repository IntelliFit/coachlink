import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { getApiUserId } from "@/lib/getApiUserId";

import type { ApiData } from "@/types/api";
import type {
    ListPublicActionsDto,
    ListPublicActionsResponseDto,
    PublicActionContributorDto,
    PublicActionItemDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        const userId = await getApiUserId(req);
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

        // 点赞、已加入、贡献者和标准动作元数据彼此独立。动作库一次会读取数百条，
        // 串行查询很容易把小程序 30 秒请求窗口全部耗尽，因此统一并发读取。
        const targetTable =
            viewerActionType === "coach" ? "coach_actions" : "student_actions";
        const ownerColumn =
            viewerActionType === "coach" ? "coach_id" : "user_id";
        const [likesResult, addedResult, profilesResult, canonicalResult] = await Promise.all([
            userId && actionIds.length > 0
                ? supabase
                    .from("community_action_likes")
                    .select("action_id")
                    .eq("user_id", userId)
                    .in("action_id", actionIds)
                : Promise.resolve({ data: [] as Array<{ action_id: string }>, error: null }),
            userId && actionNames.length > 0
                ? supabase
                    .from(targetTable)
                    .select("name")
                    .eq(ownerColumn, userId)
                    .in("name", actionNames)
                : Promise.resolve({ data: [] as Array<{ name: string }>, error: null }),
            contributorIds.length > 0
                ? supabase
                    .from("user_profiles")
                    .select("user_id, nickname, avatar_url")
                    .in("user_id", contributorIds)
                : Promise.resolve({
                    data: [] as Array<{ user_id: string; nickname: string | null; avatar_url: string | null }>,
                    error: null,
                }),
            canonicalIds.length > 0
                ? supabase
                    .from("canonical_actions")
                    .select("id, category, reference_image_url")
                    .in("id", canonicalIds)
                : Promise.resolve({
                    data: [] as Array<{ id: string; category: string | null; reference_image_url: string | null }>,
                    error: null,
                }),
        ]);

        if (canonicalResult.error) {
            console.warn(
                "[public-action-lib] load canonical reference images failed:",
                canonicalResult.error,
            );
        }

        const likedIds = new Set(
            (likesResult.data || []).map((row: any) => row.action_id),
        );
        const addedNames = new Set(
            (addedResult.data || []).map((row: any) => row.name),
        );
        const contributorMap = new Map<string, PublicActionContributorDto>();
        for (const profile of profilesResult.data || []) {
            contributorMap.set(profile.user_id, {
                userId: profile.user_id,
                nickname: profile.nickname ?? null,
                avatarUrl: profile.avatar_url ?? null,
            });
        }

        const canonicalMetadataMap = new Map<string, { category: string | null; referenceImageUrl: string | null }>();
        for (const row of canonicalResult.data || []) {
            canonicalMetadataMap.set(row.id, {
                category: row.category ?? null,
                referenceImageUrl: row.reference_image_url ?? null,
            });
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
            category: a.canonical_action_id
                ? canonicalMetadataMap.get(a.canonical_action_id)?.category ?? null
                : null,
            reference_image_url:
                a.canonical_action_id
                    ? canonicalMetadataMap.get(a.canonical_action_id)?.referenceImageUrl ?? null
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
