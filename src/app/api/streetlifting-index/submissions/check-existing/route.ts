import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type { StreetliftingCheckExistingResponseDto } from "./entity";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        const userId = session?.user?.id;
        if (!userId) {
            return NextResponse.json<ApiData<StreetliftingCheckExistingResponseDto>>(
                {
                    success: false,
                    message: "请先登录",
                    data: null,
                },
                { status: 401 },
            );
        }

        const db = serviceRoleSupabase;

        // 检查用户是否已有数据
        const { data: existingData, error } = await db
            .from("streetlifting_submissions")
            .select("id, created_at, exercise_type, bodyweight, added_weight, reps")
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error("[streetlifting-index][submissions] check-existing error:", error);
            return NextResponse.json<ApiData<StreetliftingCheckExistingResponseDto>>({
                success: false,
                message: error.message || "检查失败",
                data: null,
            }, { status: 500 });
        }

        const hasExisting = !!existingData;

        return NextResponse.json<ApiData<StreetliftingCheckExistingResponseDto>>({
            success: true,
            message: "检查成功",
            data: {
                hasExisting,
                existingSubmission: hasExisting ? existingData as any : null,
            },
        });
    } catch (error) {
        console.error("[streetlifting-index][submissions] check-existing error:", error);
        return NextResponse.json<ApiData<StreetliftingCheckExistingResponseDto>>({
            success: false,
            message: "服务器异常",
            data: null,
        }, { status: 500 });
    }
}
