import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type {
    StreetliftingListSubmissionsDto,
    StreetliftingListSubmissionsResponseDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        await getServerSession();
        const body = await req.json().catch(() => ({} as StreetliftingListSubmissionsDto));
        const {
            limit = 0,
            order = "desc",
            sort_by = "created_at",
        } = body;

        const db = serviceRoleSupabase;
        let query = db
            .from("streetlifting_submissions")
            .select("*")
            .order(sort_by, { ascending: order === "asc" });

        if (limit && limit > 0) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
            console.error("[streetlifting-index][submissions] list error:", error);
            return NextResponse.json<ApiData<StreetliftingListSubmissionsResponseDto>>({
                success: false,
                message: error.message || "获取数据失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<StreetliftingListSubmissionsResponseDto>>({
            success: true,
            message: "获取数据成功",
            data: {
                submissions: data || [],
            },
        });
    } catch (error) {
        console.error("[streetlifting-index][submissions] list error:", error);
        return NextResponse.json<ApiData<StreetliftingListSubmissionsResponseDto>>({
            success: false,
            message: "服务器异常",
            data: null,
        }, { status: 500 });
    }
}
