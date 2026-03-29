import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { STREETLIFTING_LEGACY_ANONYMOUS_KEY } from "../contributorStats";

import type { ApiData } from "@/types/api";
import type {
    StreetliftingLocationContributorsDto,
    StreetliftingLocationContributorsResponseDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        await getServerSession();
        const body = (await req.json().catch(() => ({}))) as StreetliftingLocationContributorsDto;
        const limitRaw = Number(body?.limit || 10);
        const limit = Math.min(50, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 10));

        const { data, error } = await serviceRoleSupabase
            .from("streetlifting_location_contributors")
            .select("contributor_key, contributor_user_id, display_name, upload_count, detail_score_total, image_count_total, contribution_score, last_contributed_at")
            .neq("contributor_key", STREETLIFTING_LEGACY_ANONYMOUS_KEY)
            .order("contribution_score", { ascending: false })
            .order("upload_count", { ascending: false })
            .order("detail_score_total", { ascending: false })
            .order("last_contributed_at", { ascending: false })
            .limit(limit);

        if (error) {
            console.error("[streetlifting-index][locations] contributors error:", error);
            return NextResponse.json<ApiData<StreetliftingLocationContributorsResponseDto>>({
                success: false,
                message: error.message || "获取贡献榜失败",
                data: null,
            }, { status: 500 });
        }

        const contributorUserIds = Array.from(new Set(
            (data || [])
                .map((row: any) => String(row?.contributor_user_id || "").trim())
                .filter(Boolean),
        ));

        let profileNameMap = new Map<string, string>();
        if (contributorUserIds.length > 0) {
            const { data: profiles, error: profileError } = await serviceRoleSupabase
                .from("user_profiles")
                .select("user_id, nickname, full_name")
                .in("user_id", contributorUserIds);

            if (profileError) {
                console.error("[streetlifting-index][locations] contributor profile error:", profileError);
            } else {
                profileNameMap = new Map(
                    (profiles || [])
                        .map((profile: any) => {
                            const userId = String(profile?.user_id || "").trim();
                            const displayName = String(profile?.nickname || "").trim() || String(profile?.full_name || "").trim();
                            if (!userId || !displayName) return null;
                            return [userId, displayName] as const;
                        })
                        .filter(Boolean) as Array<readonly [string, string]>,
                );
            }
        }

        const contributors = (data || []).map((row: any) => ({
            ...row,
            display_name: profileNameMap.get(String(row?.contributor_user_id || "").trim()) || row.display_name,
        }));

        return NextResponse.json<ApiData<StreetliftingLocationContributorsResponseDto>>({
            success: true,
            message: "获取贡献榜成功",
            data: {
                contributors: contributors as any,
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
