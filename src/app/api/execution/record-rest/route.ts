import { NextRequest, NextResponse } from "next/server";
import { executionActionKey } from "@coachlink/core/src/executionActionOrder";
import { applyActualRest, parseRecordRestInput, type RecordRestInput } from "@coachlink/core/src/restRecord";
import { getApiUserId } from "@/lib/getApiUserId";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { validateExecutionSubscriptionAccess } from "../_helpers/subscriptionAccess";
import { updateExecutionIfUnchanged } from "../_helpers/conditionalUpdate";

type RecordRestResponseDto = { executionId: string; actionIndex: number; setIndex: number; actualRestSeconds: number };

const fail = (message: string, status: number) =>
    NextResponse.json<ApiData<RecordRestResponseDto>>({ success: false, message, data: null }, { status });

/** 只是补一个字段：并发写冲突时重读重试，而不是让学员看到报错。 */
const MAX_ATTEMPTS = 3;

type AttemptResult = { done: true; response?: NextResponse } | { done: false };

async function attemptRecord(input: RecordRestInput, userId: string, checkAccess: boolean): Promise<AttemptResult> {
    const { data: execution, error: fetchError } = await supabase
        .from("plan_instance_executions")
        .select("*")
        .eq("id", input.executionId)
        .single();
    if (fetchError || !execution) return { done: true, response: fail("执行记录不存在", 404) };
    if (execution.student_id !== userId) return { done: true, response: fail("无权访问此记录", 403) };
    // 最后一组完成会自动结束训练，那一组之后的休息仍然要记，所以 completed 也允许。
    if (!["in_progress", "completed"].includes(String(execution.status || "").toLowerCase())) {
        return { done: true, response: fail("这次训练已经结束", 409) };
    }

    if (checkAccess) {
        const accessDecision = await validateExecutionSubscriptionAccess({
            instanceId: execution.instance_id,
            studentId: userId,
            dayIndex: execution.day_index,
        });
        if (!accessDecision.allowed) {
            return { done: true, response: fail(accessDecision.message || "无权访问此计划", accessDecision.status) };
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actions = (Array.isArray(execution.action_executions) ? execution.action_executions : []) as any[];
    if (executionActionKey(actions[input.actionIndex]) !== input.actionKey) {
        return { done: true, response: fail("训练内容已变化", 409) };
    }
    const applied = applyActualRest(actions, input.actionIndex, input.setIndex, input.actualRestSeconds);
    if (!applied.ok) return { done: true, response: fail("这一组还没有完成记录", 409) };

    const { data: saved, error: updateError } = await updateExecutionIfUnchanged({
        client: supabase,
        execution,
        patch: { action_executions: applied.actions, last_saved_at: new Date().toISOString() },
    });
    if (updateError) {
        console.error("记录组间休息失败:", updateError);
        return { done: true, response: fail("保存失败", 500) };
    }
    return saved ? { done: true } : { done: false };
}

/**
 * POST /api/execution/record-rest
 * 记录某一已完成组之后实际休息了多久（actual_rest_seconds）。只写这一个字段，不改计划间歇。
 */
export async function POST(request: NextRequest) {
    try {
        const userId = await getApiUserId(request);
        if (!userId) return fail("未登录", 401);

        const input = parseRecordRestInput(await request.json().catch(() => null));
        if (!input) return fail("参数不完整", 400);

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
            const result = await attemptRecord(input, userId, attempt === 0);
            if (!result.done) continue;
            if (result.response) return result.response;
            return NextResponse.json<ApiData<RecordRestResponseDto>>({
                success: true,
                message: "已记录休息时长",
                data: {
                    executionId: input.executionId,
                    actionIndex: input.actionIndex,
                    setIndex: input.setIndex,
                    actualRestSeconds: input.actualRestSeconds,
                },
            });
        }
        return fail("训练记录正在更新，请稍后重试", 409);
    } catch (error) {
        console.error("记录组间休息失败:", error);
        return fail("服务器错误", 500);
    }
}
