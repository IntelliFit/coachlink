import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type {
    StreetliftingListFormulasDto,
    StreetliftingListFormulasResponseDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        await getServerSession();
        const body = await req.json().catch(() => ({} as StreetliftingListFormulasDto));
        const { exercise_type } = body;

        const db = serviceRoleSupabase;
        let query = db
            .from("streetlifting_formulas")
            .select("*")
            .order("last_updated", { ascending: false });

        if (exercise_type) {
            query = query.eq("exercise_type", exercise_type);
        }

        const { data, error } = await query;

        if (error) {
            console.error("[streetlifting-index][formulas] error:", error);
            return NextResponse.json<ApiData<StreetliftingListFormulasResponseDto>>({
                success: false,
                message: error.message || "获取公式失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<StreetliftingListFormulasResponseDto>>({
            success: true,
            message: "获取公式成功",
            data: {
                formulas: data || [],
            },
        });
    } catch (error) {
        console.error("[streetlifting-index][formulas] error:", error);
        return NextResponse.json<ApiData<StreetliftingListFormulasResponseDto>>({
            success: false,
            message: "服务器异常",
            data: null,
        }, { status: 500 });
    }
}
