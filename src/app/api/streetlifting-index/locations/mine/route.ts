import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { getLocationGaps, getLocationProvince, getLocationRegionCountry, withLocationEquipment } from '@coachlink/core';
import { getStreetliftingLocationImageCount } from "../contributorStats";

import type { ApiData } from "@/types/api";
import type { StreetliftingLocation } from "../list/entity";
import type { StreetliftingMyLocationsResponseDto } from "./entity";

// A single contributor's points; far above anyone's real count, keeps the read bounded.
const MAX_MY_LOCATIONS = 500;

function fail(message: string, status: number) {
    return NextResponse.json<ApiData<StreetliftingMyLocationsResponseDto>>({ success: false, message, data: null }, { status });
}

async function readContributorRank(userId: string) {
    const { data: mine, error } = await serviceRoleSupabase
        .from("streetlifting_location_contributors")
        .select("contribution_score")
        .eq("contributor_key", `user:${userId}`)
        .maybeSingle();
    if (error || !mine) return { contribution_score: null, rank: null };

    const { count, error: rankError } = await serviceRoleSupabase
        .from("streetlifting_location_contributors")
        .select("contributor_key", { count: "exact", head: true })
        .gt("contribution_score", mine.contribution_score);
    return { contribution_score: mine.contribution_score, rank: rankError ? null : (count || 0) + 1 };
}

export async function POST() {
    try {
        const session = await getServerSession();
        // Identity comes only from the session; the body is ignored on purpose.
        const userId = String(session?.user?.id || "").trim();
        if (!userId) return fail("请先登录", 401);

        const { data, error } = await serviceRoleSupabase
            .from("streetlifting_locations")
            .select("*")
            .eq("contributor_user_id", userId)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(0, MAX_MY_LOCATIONS - 1);

        if (error) {
            console.error("[streetlifting-index][locations] mine error:", error);
            return fail(error.message || "获取我的点位失败", 500);
        }

        const locations = ((data || []) as StreetliftingLocation[]).map(item => ({
            ...withLocationEquipment(item),
            country: getLocationRegionCountry(item) || null,
            province: getLocationProvince(item) || item.province,
            gaps: getLocationGaps(item),
        }));
        const ranking = await readContributorRank(userId);

        return NextResponse.json<ApiData<StreetliftingMyLocationsResponseDto>>({
            success: true,
            message: "ok",
            data: {
                locations,
                summary: {
                    upload_count: locations.length,
                    image_count_total: locations.reduce((sum, item) => sum + getStreetliftingLocationImageCount(item), 0),
                    needs_update_count: locations.filter(item => item.gaps.length > 0).length,
                    ...ranking,
                },
            },
        });
    } catch (error) {
        console.error("[streetlifting-index][locations] mine error:", error);
        return fail("服务器异常", 500);
    }
}
