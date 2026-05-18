import { NextRequest, NextResponse } from "next/server";
import { getApiUserId } from "@/lib/getApiUserId";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";

interface TrainingHistorySummaryDto {
    totalSessions: number;
    totalActions: number;
    totalSets: number;
}

function countActions(raw: unknown): number {
    return Array.isArray(raw) ? raw.length : 0;
}

export async function GET(request: NextRequest) {
    try {
        const userId = await getApiUserId(request);
        if (!userId) {
            return NextResponse.json<ApiData<TrainingHistorySummaryDto>>({
                success: false,
                message: "用户未登录",
                data: null,
            }, { status: 401 });
        }

        const [
            { data: planExecs, error: planError },
            { data: impromptuExecs, error: impromptuError },
        ] = await Promise.all([
            supabase
                .from("plan_instance_executions")
                .select("id, completed_sets, action_executions")
                .eq("student_id", userId)
                .eq("status", "completed"),
            supabase
                .from("impromptu_executions")
                .select("id, completed_sets, action_executions")
                .eq("student_id", userId)
                .eq("status", "completed"),
        ]);

        if (planError || impromptuError) {
            console.error(
                "[training-history/summary] query failed:",
                planError || impromptuError,
            );
            return NextResponse.json<ApiData<TrainingHistorySummaryDto>>({
                success: false,
                message: "获取训练记录统计失败",
                data: null,
            }, { status: 500 });
        }

        const executions = [...(planExecs || []), ...(impromptuExecs || [])];
        const totalActions = executions.reduce(
            (sum, item: any) => sum + countActions(item.action_executions),
            0,
        );
        const totalSets = executions.reduce(
            (sum, item: any) => sum + Number(item.completed_sets || 0),
            0,
        );

        return NextResponse.json<ApiData<TrainingHistorySummaryDto>>({
            success: true,
            message: "获取训练记录统计成功",
            data: {
                totalSessions: executions.length,
                totalActions,
                totalSets,
            },
        });
    } catch (error) {
        console.error("[training-history/summary] unexpected:", error);
        return NextResponse.json<ApiData<TrainingHistorySummaryDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
