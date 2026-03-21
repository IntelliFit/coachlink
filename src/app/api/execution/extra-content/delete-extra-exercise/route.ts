import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { DeleteExtraExerciseDto, DeleteExtraExerciseResponseDto } from "../entity";
import { computeExecutionProgress } from "@/lib/executionProgress";
import { validateExecutionSubscriptionAccess } from "../../_helpers/subscriptionAccess";

/**
 * POST /api/execution/extra-content/delete-extra-exercise
 *
 * 删除学员自行添加的动作（仅限 source: "student_extra"）
 * 教练给定的动作不能删除
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<DeleteExtraExerciseResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }

        const userId = session.user.id;
        const body: DeleteExtraExerciseDto = await request.json();
        const { executionId, actionIndex } = body;

        if (!executionId || actionIndex === undefined) {
            return NextResponse.json<ApiData<DeleteExtraExerciseResponseDto>>({
                success: false,
                message: "缺少必填参数: executionId, actionIndex",
                data: null,
            }, { status: 400 });
        }

        const { data: execution, error: fetchError } = await supabase
            .from("plan_instance_executions")
            .select("*")
            .eq("id", executionId)
            .single();

        if (fetchError || !execution) {
            return NextResponse.json<ApiData<DeleteExtraExerciseResponseDto>>({
                success: false,
                message: "执行记录不存在",
                data: null,
            }, { status: 404 });
        }

        if (execution.student_id !== userId) {
            return NextResponse.json<ApiData<DeleteExtraExerciseResponseDto>>({
                success: false,
                message: "无权访问此记录",
                data: null,
            }, { status: 403 });
        }

        const accessDecision = await validateExecutionSubscriptionAccess({
            instanceId: execution.instance_id,
            studentId: userId,
            dayIndex: execution.day_index,
        });
        if (!accessDecision.allowed) {
            return NextResponse.json<ApiData<DeleteExtraExerciseResponseDto>>({
                success: false,
                message: accessDecision.message || "无权访问此计划",
                data: null,
            }, { status: accessDecision.status });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actionExecutions = execution.action_executions as any[];
        if (!actionExecutions[actionIndex]) {
            return NextResponse.json<ApiData<DeleteExtraExerciseResponseDto>>({
                success: false,
                message: "动作不存在",
                data: null,
            }, { status: 400 });
        }

        const targetAction = actionExecutions[actionIndex];
        if (targetAction.source !== "student_extra") {
            return NextResponse.json<ApiData<DeleteExtraExerciseResponseDto>>({
                success: false,
                message: "只能删除您自行添加的动作，教练计划的动作不能删除",
                data: null,
            }, { status: 403 });
        }

        actionExecutions.splice(actionIndex, 1);
        // 重新编号 action_order
        actionExecutions.forEach((a: any, idx: number) => {
            a.action_order = idx + 1;
            a.action_index = idx;
        });

        const progress = computeExecutionProgress(actionExecutions);

        const { error: updateError } = await supabase
            .from("plan_instance_executions")
            .update({
                action_executions: actionExecutions,
                total_sets: progress.totalItems,
                last_saved_at: new Date().toISOString(),
            })
            .eq("id", executionId);

        if (updateError) {
            console.error("删除额外动作失败:", updateError);
            return NextResponse.json<ApiData<DeleteExtraExerciseResponseDto>>({
                success: false,
                message: "更新失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<DeleteExtraExerciseResponseDto>>({
            success: true,
            message: "已删除",
            data: {
                executionId,
                totalSets: progress.totalItems,
            },
        });
    } catch (error) {
        console.error("删除额外动作失败:", error);
        return NextResponse.json<ApiData<DeleteExtraExerciseResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
