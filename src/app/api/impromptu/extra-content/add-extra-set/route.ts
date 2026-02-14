import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    AddImpromptuExtraSetDto,
    AddImpromptuExtraSetResponseDto,
} from "../entity";
import { computeExecutionProgress } from "@/lib/executionProgress";

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<AddImpromptuExtraSetResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }
        const userId = session.user.id;
        const body: AddImpromptuExtraSetDto = await request.json();
        const { executionId, actionIndex, weight, reps, restSeconds } = body;
        if (!executionId || actionIndex === undefined) {
            return NextResponse.json<ApiData<AddImpromptuExtraSetResponseDto>>({
                success: false,
                message: "缺少必填参数",
                data: null,
            }, { status: 400 });
        }

        const { data: execution } = await supabase
            .from("impromptu_executions")
            .select("*")
            .eq("id", executionId)
            .single();
        if (!execution) {
            return NextResponse.json<ApiData<AddImpromptuExtraSetResponseDto>>({
                success: false,
                message: "执行记录不存在",
                data: null,
            }, { status: 404 });
        }
        if (execution.student_id !== userId) {
            return NextResponse.json<ApiData<AddImpromptuExtraSetResponseDto>>({
                success: false,
                message: "无权访问此记录",
                data: null,
            }, { status: 403 });
        }

        const actionExecutions = (execution.action_executions || []) as any[];
        if (!actionExecutions[actionIndex]) {
            return NextResponse.json<ApiData<AddImpromptuExtraSetResponseDto>>({
                success: false,
                message: "动作不存在",
                data: null,
            }, { status: 400 });
        }

        const action = actionExecutions[actionIndex];
        const sets = Array.isArray(action.sets) ? action.sets : [];
        const newSetIndex = sets.length;
        sets.push({
            set_number: newSetIndex + 1,
            set_index: newSetIndex,
            planned_weight: weight ?? null,
            planned_reps: reps ?? null,
            planned_rest_seconds: restSeconds || 60,
            status: "pending",
            source: "student_extra",
            created_at: new Date().toISOString(),
        });
        action.sets = sets;
        action.total_sets = sets.length;

        const progress = computeExecutionProgress(actionExecutions);
        const { error: updateError } = await supabase
            .from("impromptu_executions")
            .update({
                action_executions: actionExecutions,
                total_sets: progress.totalItems,
                last_saved_at: new Date().toISOString(),
            })
            .eq("id", executionId);

        if (updateError) {
            return NextResponse.json<ApiData<AddImpromptuExtraSetResponseDto>>({
                success: false,
                message: "更新失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<AddImpromptuExtraSetResponseDto>>({
            success: true,
            message: "成功添加额外组",
            data: {
                executionId,
                actionIndex,
                newSetIndex,
                totalSets: progress.totalItems,
            },
        });
    } catch (error) {
        console.error("add impromptu extra set error:", error);
        return NextResponse.json<ApiData<AddImpromptuExtraSetResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}

