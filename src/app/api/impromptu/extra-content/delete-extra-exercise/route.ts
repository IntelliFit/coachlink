import { NextRequest, NextResponse } from "next/server";
import { getApiUserId } from "@/lib/getApiUserId";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    DeleteImpromptuExtraExerciseDto,
    DeleteImpromptuExtraExerciseResponseDto,
} from "../entity";
import { computeExecutionProgress } from "@/lib/executionProgress";

export async function POST(request: NextRequest) {
    try {
        const userId = await getApiUserId(request);
        if (!userId) {
            return NextResponse.json<ApiData<DeleteImpromptuExtraExerciseResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }
        const body: DeleteImpromptuExtraExerciseDto = await request.json();
        const { executionId, actionIndex } = body;
        if (!executionId || actionIndex === undefined) {
            return NextResponse.json<ApiData<DeleteImpromptuExtraExerciseResponseDto>>({
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
            return NextResponse.json<ApiData<DeleteImpromptuExtraExerciseResponseDto>>({
                success: false,
                message: "执行记录不存在",
                data: null,
            }, { status: 404 });
        }
        if (execution.student_id !== userId) {
            return NextResponse.json<ApiData<DeleteImpromptuExtraExerciseResponseDto>>({
                success: false,
                message: "无权访问此记录",
                data: null,
            }, { status: 403 });
        }

        if (String(execution.status || "").toLowerCase() !== "in_progress") {
            return NextResponse.json<ApiData<DeleteImpromptuExtraExerciseResponseDto>>({
                success: false,
                message: "训练已结束，不能继续修改动作或组",
                data: null,
            }, { status: 400 });
        }

        const actionExecutions = (execution.action_executions || []) as any[];
        const action = actionExecutions[actionIndex];
        if (!action) {
            return NextResponse.json<ApiData<DeleteImpromptuExtraExerciseResponseDto>>({
                success: false,
                message: "动作不存在",
                data: null,
            }, { status: 400 });
        }
        if (action.source !== "student_extra") {
            return NextResponse.json<ApiData<DeleteImpromptuExtraExerciseResponseDto>>({
                success: false,
                message: "只能删除自行添加的动作",
                data: null,
            }, { status: 403 });
        }

        actionExecutions.splice(actionIndex, 1);
        actionExecutions.forEach((item: any, idx: number) => {
            item.action_order = idx + 1;
            item.action_index = idx;
        });
        const progress = computeExecutionProgress(actionExecutions);

        const { error: updateError } = await supabase
            .from("impromptu_executions")
            .update({
                action_executions: actionExecutions,
                total_sets: progress.totalItems,
                last_saved_at: new Date().toISOString(),
            })
            .eq("id", executionId)
            .eq("student_id", userId);
        if (updateError) {
            return NextResponse.json<ApiData<DeleteImpromptuExtraExerciseResponseDto>>({
                success: false,
                message: "更新失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<DeleteImpromptuExtraExerciseResponseDto>>({
            success: true,
            message: "已删除",
            data: {
                executionId,
                totalSets: progress.totalItems,
            },
        });
    } catch (error) {
        console.error("delete impromptu extra action error:", error);
        return NextResponse.json<ApiData<DeleteImpromptuExtraExerciseResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}

