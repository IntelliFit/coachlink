import { NextResponse } from "next/server";
import { getServerSession } from "../../auth/[...nextauth]/auth";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type { StreetliftingStatsDto, StreetliftingStatsResponseDto } from "./entity";

export async function POST(req: Request) {
    try {
        await getServerSession();
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

        return NextResponse.json<ApiData<StreetliftingStatsResponseDto>>({
            success: true,
            message: "获取统计成功",
            data: {
                totalCount: totalCount || 0,
                lastUpdated: formulas?.[0]?.last_updated || null,
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
