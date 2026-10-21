import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { STREETLIFTING_LEGACY_ANONYMOUS_KEY } from "../contributorStats";

import type { ApiData } from "@/types/api";
import type {
    StreetliftingLocationContributorsDto,
    StreetliftingLocationContributorsResponseDto,
    StreetliftingLocationContributorItem,
} from "./entity";

export async function POST(req: Request) {
    try {
        await getServerSession();
        const body = (await req.json().catch(() => ({}))) as StreetliftingLocationContributorsDto;
        const limitRaw = Number(body?.limit || 10);
        // Omit limit for the complete leaderboard; keep explicit limits for older clients.
        const limit = body?.limit == null
            ? null
            : Math.min(50, Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 10));
        const batchSize = 500;
        const data: StreetliftingLocationContributorItem[] = [];

        for (let from = 0; ; from += batchSize) {
            const pageSize = limit ?? batchSize;
            const { data: rows, error } = await serviceRoleSupabase
                .from("streetlifting_location_contributors")
                .select("contributor_key, contributor_user_id, display_name, upload_count, detail_score_total, image_count_total, contribution_score, last_contributed_at")
                .neq("contributor_key", STREETLIFTING_LEGACY_ANONYMOUS_KEY)
                .order("contribution_score", { ascending: false })
                .order("upload_count", { ascending: false })
                .order("detail_score_total", { ascending: false })
                .order("last_contributed_at", { ascending: false })
                .order("contributor_key", { ascending: true })
                .range(from, from + pageSize - 1);

            if (error) {
                console.error("[streetlifting-index][locations] contributors error:", error);
                return NextResponse.json<ApiData<StreetliftingLocationContributorsResponseDto>>({
                    success: false,
                    message: error.message || "获取贡献榜失败",
                    data: null,
                }, { status: 500 });
            }

            data.push(...((rows || []) as StreetliftingLocationContributorItem[]));
            if (limit !== null || (rows || []).length < pageSize) break;
        }

        const contributorUserIds = Array.from(new Set(
            data
                .map((row) => String(row.contributor_user_id || "").trim())
                .filter(Boolean),
        ));

        const profileNameMap = new Map<string, string>();
        // Keep the IN filter URL small even when user IDs are UUIDs.
        const profileBatchSize = 100;
        for (let from = 0; from < contributorUserIds.length; from += profileBatchSize) {
            const { data: profiles, error: profileError } = await serviceRoleSupabase
                .from("user_profiles")
                .select("user_id, nickname, full_name")
                .in("user_id", contributorUserIds.slice(from, from + profileBatchSize));

            if (profileError) {
                console.error("[streetlifting-index][locations] contributor profile error:", profileError);
            } else {
                for (const profile of profiles || []) {
                    const userId = String(profile?.user_id || "").trim();
                    const displayName = String(profile?.nickname || "").trim() || String(profile?.full_name || "").trim();
                    if (userId && displayName) profileNameMap.set(userId, displayName);
                }
            }
        }

        const contributors = data.map((row) => ({
            ...row,
            display_name: profileNameMap.get(String(row?.contributor_user_id || "").trim()) || row.display_name,
        }));

        return NextResponse.json<ApiData<StreetliftingLocationContributorsResponseDto>>({
            success: true,
            message: "获取贡献榜成功",
            data: {
                contributors,
            },
        });
    } catch (error) {
        console.error("[streetlifting-index][locations] contributors error:", error);
        return NextResponse.json<ApiData<StreetliftingLocationContributorsResponseDto>>({
            success: false,
            message: "服务器异常",
            data: null,
        }, { status: 500 });
    }
}
