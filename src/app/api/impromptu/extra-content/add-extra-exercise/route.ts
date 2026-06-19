import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    AddImpromptuExtraExerciseDto,
    AddImpromptuExtraExerciseResponseDto,
} from "../entity";
import { computeExecutionProgress } from "@/lib/executionProgress";

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<AddImpromptuExtraExerciseResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }
        const userId = session.user.id;
        const body: AddImpromptuExtraExerciseDto = await request.json();
        const { executionId, actionId, actionName, sets } = body;
        if (!executionId || !actionId || !actionName) {
            return NextResponse.json<ApiData<AddImpromptuExtraExerciseResponseDto>>({
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
            return NextResponse.json<ApiData<AddImpromptuExtraExerciseResponseDto>>({
                success: false,
                message: "执行记录不存在",
                data: null,
            }, { status: 404 });
        }
        if (execution.student_id !== userId) {
            return NextResponse.json<ApiData<AddImpromptuExtraExerciseResponseDto>>({
                success: false,
                message: "无权访问此记录",
                data: null,
            }, { status: 403 });
        }

        const { data: studentAction } = await supabase
            .from("student_actions")
            .select("id, name, type")
            .eq("id", actionId)
            .eq("user_id", userId)
            .single();
        if (!studentAction) {
            return NextResponse.json<ApiData<AddImpromptuExtraExerciseResponseDto>>({
                success: false,
                message: "动作不存在于您的动作库",
                data: null,
            }, { status: 400 });
        }

        const actionExecutions = (execution.action_executions || []) as any[];
        const newActionIndex = actionExecutions.length;
        const newSets = (sets || [{ weight: null, reps: null }]).map((s, idx) => ({
            set_number: idx + 1,
            set_index: idx,
            planned_weight: s.weight ?? null,
            planned_reps: s.reps ?? null,
            planned_rest_seconds: s.restSeconds ?? 60,
            rest_seconds: s.restSeconds ?? 60,
            status: "pending",
            source: "student_extra",
        }));

        actionExecutions.push({
            action_index: newActionIndex,
            action_id: actionId,
            action_name: actionName,
            type: studentAction.type || "STRENGTH",
            source: "student_extra",
            source_action_id: actionId,
            sets: newSets,
            total_sets: newSets.length,
            completed_sets: 0,
            created_at: new Date().toISOString(),
        });

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
            return NextResponse.json<ApiData<AddImpromptuExtraExerciseResponseDto>>({
                success: false,
                message: "更新失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<AddImpromptuExtraExerciseResponseDto>>({
            success: true,
            message: "成功添加额外动作",
            data: {
                executionId,
                newActionIndex,
                actionName,
                setsCount: newSets.length,
                totalSets: progress.totalItems,
            },
        });
    } catch (error) {
        console.error("add impromptu extra action error:", error);
        return NextResponse.json<ApiData<AddImpromptuExtraExerciseResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}

