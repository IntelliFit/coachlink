import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { DeleteExtraSetDto, DeleteExtraSetResponseDto } from "../entity";
import { computeExecutionProgress } from "@/lib/executionProgress";
import { validateExecutionSubscriptionAccess } from "../../_helpers/subscriptionAccess";

/**
 * POST /api/execution/extra-content/delete-extra-set
 *
 * 删除学员自行添加的组（仅限 source: "student_extra"）
 * 教练给定的组不能删除
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<DeleteExtraSetResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }

        const userId = session.user.id;
        const body: DeleteExtraSetDto = await request.json();
        const { executionId, actionIndex, setIndex } = body;

        if (!executionId || actionIndex === undefined || setIndex === undefined) {
            return NextResponse.json<ApiData<DeleteExtraSetResponseDto>>({
                success: false,
                message: "缺少必填参数: executionId, actionIndex, setIndex",
                data: null,
            }, { status: 400 });
        }

        const { data: execution, error: fetchError } = await supabase
            .from("plan_instance_executions")
            .select("*")
            .eq("id", executionId)
            .single();

        if (fetchError || !execution) {
            return NextResponse.json<ApiData<DeleteExtraSetResponseDto>>({
                success: false,
                message: "执行记录不存在",
                data: null,
            }, { status: 404 });
        }

        if (execution.student_id !== userId) {
            return NextResponse.json<ApiData<DeleteExtraSetResponseDto>>({
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
            return NextResponse.json<ApiData<DeleteExtraSetResponseDto>>({
                success: false,
                message: accessDecision.message || "无权访问此计划",
                data: null,
            }, { status: accessDecision.status });
        }

        if (String(execution.status || "").toLowerCase() !== "in_progress") {
            return NextResponse.json<ApiData<DeleteExtraSetResponseDto>>({
                success: false,
                message: "训练已结束，不能继续修改动作或组",
                data: null,
            }, { status: 400 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actionExecutions = execution.action_executions as any[];
        if (!actionExecutions[actionIndex]) {
            return NextResponse.json<ApiData<DeleteExtraSetResponseDto>>({
                success: false,
                message: "动作不存在",
                data: null,
            }, { status: 400 });
        }

        const action = actionExecutions[actionIndex];
        const sets = action.sets || [];
        if (!sets[setIndex]) {
            return NextResponse.json<ApiData<DeleteExtraSetResponseDto>>({
                success: false,
                message: "组不存在",
                data: null,
            }, { status: 400 });
        }

        const targetSet = sets[setIndex];
        if (targetSet.source !== "student_extra") {
            return NextResponse.json<ApiData<DeleteExtraSetResponseDto>>({
                success: false,
                message: "只能删除您自行添加的组，教练计划的组不能删除",
                data: null,
            }, { status: 403 });
        }

        sets.splice(setIndex, 1);
        // 重新编号 set_number
        sets.forEach((s: any, idx: number) => {
            s.set_number = idx + 1;
            s.set_index = idx;
        });
        action.sets = sets;
        action.total_sets = sets.length;

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
            console.error("删除额外组失败:", updateError);
            return NextResponse.json<ApiData<DeleteExtraSetResponseDto>>({
                success: false,
                message: "更新失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<DeleteExtraSetResponseDto>>({
            success: true,
            message: "已删除",
            data: {
                executionId,
                actionIndex,
                totalSets: progress.totalItems,
            },
        });
    } catch (error) {
        console.error("删除额外组失败:", error);
        return NextResponse.json<ApiData<DeleteExtraSetResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
