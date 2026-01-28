import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type { StreetliftingListLocationsResponseDto } from "./entity";

export async function POST() {
    try {
        await getServerSession();
        const db = serviceRoleSupabase;
        const { data, error } = await db
            .from("streetlifting_locations")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("[streetlifting-index][locations] list error:", error);
            return NextResponse.json<ApiData<StreetliftingListLocationsResponseDto>>({
                success: false,
                message: error.message || "获取地点失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<StreetliftingListLocationsResponseDto>>({
            success: true,
            message: "获取地点成功",
            data: {
                locations: data || [],
            },
        });
    } catch (error) {
        console.error("[streetlifting-index][locations] list error:", error);
        return NextResponse.json<ApiData<StreetliftingListLocationsResponseDto>>({
            success: false,
            message: "服务器异常",
            data: null,
        }, { status: 500 });
    }
}
