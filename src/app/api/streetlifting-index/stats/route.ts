import { NextResponse } from "next/server";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type { StreetliftingStatsDto, StreetliftingStatsResponseDto } from "./entity";
import { getStreetliftingLocationImageCount } from "../locations/contributorStats";
import { getLocationProvince } from "@coachlink/core";

type LocationStatsRow = {
    created_at: string | null;
    description: string | null;
    country?: string | null;
    province: string | null;
    city: string | null;
    address?: string | null;
    latitude: number | null;
    longitude: number | null;
    image_url: string | null;
    image_urls: string[] | null;
};

function normalizeAreaName(value: string | null | undefined, fallback: string): string {
    const trimmed = String(value || "").trim();
    return trimmed || fallback;
}

function formatMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function POST(req: Request) {
    try {
        // Public aggregate data does not require loading the caller's profile.
        await req.json().catch(() => ({} as StreetliftingStatsDto));

        const db = serviceRoleSupabase;

        const { count: totalCount, error: countError } = await db
            .from("streetlifting_submissions")
            .select("*", { count: "exact", head: true });

        if (countError) {
            console.error("[streetlifting-index][stats] count error:", countError);
            return NextResponse.json<ApiData<StreetliftingStatsResponseDto>>({
                success: false,
                message: countError.message || "统计失败",
                data: null,
            }, { status: 500 });
        }

        const { data: formulas, error: formulaError } = await db
            .from("streetlifting_formulas")
            .select("last_updated")
            .order("last_updated", { ascending: false })
            .limit(1);

        if (formulaError) {
            console.error("[streetlifting-index][stats] formula error:", formulaError);
            return NextResponse.json<ApiData<StreetliftingStatsResponseDto>>({
                success: false,
                message: formulaError.message || "获取公式更新时间失败",
                data: null,
            }, { status: 500 });
        }

        // Read every page: a single select is capped by PostgREST's row limit.
        // Keep pagination deterministic with a unique order.
        const locationRows: LocationStatsRow[] = [];
        const batchSize = 500;
        for (let from = 0; ; from += batchSize) {
            const { data: locations, error: locationError } = await db
                .from("streetlifting_locations")
                .select("created_at, description, country, province, city, address, latitude, longitude, image_url, image_urls")
                .order("id", { ascending: true })
                .range(from, from + batchSize - 1);

            if (locationError) {
                console.error("[streetlifting-index][stats] location error:", locationError);
                return NextResponse.json<ApiData<StreetliftingStatsResponseDto>>({
                    success: false,
                    message: locationError.message || "获取地点统计失败",
                    data: null,
                }, { status: 500 });
            }

            const rows = (locations || []) as LocationStatsRow[];
            locationRows.push(...rows);
            if (rows.length < batchSize) break;
        }

        const { count: contributorCount, error: contributorCountError } = await db
            .from("streetlifting_location_contributors")
            .select("*", { count: "exact", head: true });

        if (contributorCountError) {
            console.warn("[streetlifting-index][stats] contributor table not ready:", contributorCountError.message);
        }

        const totalLocationCount = locationRows.length;
        const withImagesCount = locationRows.filter((row) => getStreetliftingLocationImageCount(row) > 0).length;
        const withDescriptionCount = locationRows.filter((row) => String(row.description || "").trim().length > 0).length;
        const mapReadyCount = locationRows.filter(
            (row) => typeof row.latitude === "number" && typeof row.longitude === "number",
        ).length;
        const imageTotal = locationRows.reduce((sum, row) => sum + getStreetliftingLocationImageCount(row), 0);

        const provinceMap = new Map<string, number>();
        const cityMap = new Map<string, number>();
        const monthMap = new Map<string, number>();

        const monthKeys: string[] = [];
        const now = new Date();
        for (let i = 5; i >= 0; i -= 1) {
            const current = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = formatMonthKey(current);
            monthKeys.push(key);
            monthMap.set(key, 0);
        }

        locationRows.forEach((row) => {
            const province = getLocationProvince(row) || "未填写省份";
            provinceMap.set(province, (provinceMap.get(province) || 0) + 1);

            const city = normalizeAreaName(row.city, province);
            cityMap.set(city, (cityMap.get(city) || 0) + 1);

            if (row.created_at) {
                const date = new Date(row.created_at);
                if (!Number.isNaN(date.getTime())) {
                    const key = formatMonthKey(date);
                    if (monthMap.has(key)) {
                        monthMap.set(key, (monthMap.get(key) || 0) + 1);
                    }
                }
            }
        });

        return NextResponse.json<ApiData<StreetliftingStatsResponseDto>>({
            success: true,
            message: "获取统计成功",
            data: {
                totalCount: totalCount || 0,
                lastUpdated: formulas?.[0]?.last_updated || null,
                locationOverview: {
                    totalCount: totalLocationCount,
                    withImagesCount,
                    withDescriptionCount,
                    averageImageCount: totalLocationCount > 0 ? Number((imageTotal / totalLocationCount).toFixed(1)) : 0,
                    provinceCount: provinceMap.size,
                    mapReadyCount,
                    contributorCount: contributorCountError ? 0 : (contributorCount || 0),
                    topProvinces: Array.from(provinceMap.entries())
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 8)
                        .map(([name, count]) => ({ name, count })),
                    topCities: Array.from(cityMap.entries())
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 6)
                        .map(([name, count]) => ({ name, count })),
                    recentMonths: monthKeys.map((month) => ({
                        month,
                        count: monthMap.get(month) || 0,
                    })),
                },
            },
        });
    } catch (error) {
        console.error("[streetlifting-index][stats] error:", error);
        return NextResponse.json<ApiData<StreetliftingStatsResponseDto>>({
            success: false,
            message: "服务器异常",
            data: null,
        }, { status: 500 });
    }
}
