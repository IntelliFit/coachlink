import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type { StreetliftingListStoriesResponseDto } from "./entity";

export async function POST() {
    try {
        await getServerSession();

        const db = serviceRoleSupabase;
        const { data, error } = await db
            .from("streetlifting_stories")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("[streetlifting-index][stories] list error:", error);
            return NextResponse.json<ApiData<StreetliftingListStoriesResponseDto>>({
                success: false,
                message: error.message || "获取故事失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<StreetliftingListStoriesResponseDto>>({
            success: true,
            message: "获取故事成功",
            data: {
                stories: data || [],
            },
        });
    } catch (error) {
        console.error("[streetlifting-index][stories] list error:", error);
        return NextResponse.json<ApiData<StreetliftingListStoriesResponseDto>>({
            success: false,
            message: "服务器异常",
            data: null,
        }, { status: 500 });
    }
}
