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
        // 兼容：支持 snake_case / camelCase 两种字段名
        const exercise_type = body.exercise_type || body.exerciseType;

        const db = serviceRoleSupabase;
        let query = db
            .from("streetlifting_formulas")
            .select("*")
            .order("last_updated", { ascending: false });

        if (exercise_type) {
            // Supabase TS 在这里容易出现“类型实例化过深”的推导问题；route 内无需强类型推导
            query = (query as any).eq("exercise_type", exercise_type);
        }

        const { data, error } = await (query as any);

        if (error) {
            console.error("[streetlifting-index][formulas] error:", error);
            return NextResponse.json<ApiData<StreetliftingListFormulasResponseDto>>({
                success: false,
                message: error.message || "获取公式失败",
                data: null,
            }, { status: 500 });
        }

        // 公式表为空时，视为未初始化（否则前端会表现为“力量分全是0/未找到公式”）
        if (!data || data.length === 0) {
            return NextResponse.json<ApiData<StreetliftingListFormulasResponseDto>>({
                success: false,
                message: "公式未初始化：streetlifting_formulas 为空，请先执行迁移/seed",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<StreetliftingListFormulasResponseDto>>({
            success: true,
            message: "获取公式成功",
            data: {
                formulas: (data || []) as any,
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
