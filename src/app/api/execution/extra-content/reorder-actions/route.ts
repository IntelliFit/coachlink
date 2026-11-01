import { NextRequest, NextResponse } from "next/server";
import { executionActionKey, isValidActionOrder, reorderExecutionActions } from "@coachlink/core/src/executionActionOrder";
import { getApiUserId } from "@/lib/getApiUserId";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { ReorderExecutionActionsDto, ReorderExecutionActionsResponseDto } from "../entity";
import { validateExecutionSubscriptionAccess } from "../../_helpers/subscriptionAccess";

const fail = (message: string, status: number) =>
    NextResponse.json<ApiData<ReorderExecutionActionsResponseDto>>({
        success: false,
        message,
        data: null,
    }, { status });

/**
 * POST /api/execution/extra-content/reorder-actions
 * 只改本次执行记录里的顺序，不改教练或学员的计划本身。
 */
export async function POST(request: NextRequest) {
    try {
        const userId = await getApiUserId(request);
        if (!userId) return fail("未登录", 401);

        const body = await request.json().catch(() => null) as ReorderExecutionActionsDto | null;
        const executionId = typeof body?.executionId === "string" ? body.executionId.trim() : "";
        if (!executionId) return fail("缺少必填参数", 400);

        const { data: execution, error: fetchError } = await supabase
            .from("plan_instance_executions")
            .select("*")
            .eq("id", executionId)
            .single();
        if (fetchError || !execution) return fail("执行记录不存在", 404);
        if (execution.student_id !== userId) return fail("无权访问此记录", 403);

        const accessDecision = await validateExecutionSubscriptionAccess({
            instanceId: execution.instance_id,
            studentId: userId,
            dayIndex: execution.day_index,
        });
        if (!accessDecision.allowed) return fail(accessDecision.message || "无权访问此计划", accessDecision.status);

        if (String(execution.status || "").toLowerCase() !== "in_progress") {
            return fail("训练已结束，不能继续修改动作或组", 400);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actions = (execution.action_executions || []) as any[];
        const order = body?.order;
        if (!isValidActionOrder(order, actions.length)) return fail("训练内容已变化，请刷新后再调整", 409);
        if (JSON.stringify(actions.map(executionActionKey)) !== JSON.stringify(body?.actionKeys)) {
            return fail("训练内容已变化，请刷新后再调整", 409);
        }

        const { error: updateError } = await supabase
            .from("plan_instance_executions")
            .update({
                action_executions: reorderExecutionActions(actions, order, { keepPlanIndex: true }),
                last_saved_at: new Date().toISOString(),
            })
            .eq("id", executionId);
        if (updateError) {
            console.error("调整动作顺序失败:", updateError);
            return fail("保存顺序失败，请重试", 500);
        }

        return NextResponse.json<ApiData<ReorderExecutionActionsResponseDto>>({
            success: true,
            message: "已调整顺序",
            data: { executionId, order },
        });
    } catch (error) {
        console.error("调整动作顺序失败:", error);
        return fail("服务器错误", 500);
    }
}
