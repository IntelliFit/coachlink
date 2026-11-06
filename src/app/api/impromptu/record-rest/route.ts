import { NextRequest, NextResponse } from "next/server";
import { executionActionKey } from "@coachlink/core/src/executionActionOrder";
import { applyActualRest, parseRecordRestInput } from "@coachlink/core/src/restRecord";
import { getApiUserId } from "@/lib/getApiUserId";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";

type RecordRestResponseDto = { executionId: string; actionIndex: number; setIndex: number; actualRestSeconds: number };

const fail = (message: string, status: number) =>
    NextResponse.json<ApiData<RecordRestResponseDto>>({ success: false, message, data: null }, { status });

/**
 * POST /api/impromptu/record-rest
 * 记录某一已完成组之后实际休息了多久（actual_rest_seconds）。只写这一个字段，不改计划间歇。
 */
export async function POST(request: NextRequest) {
    try {
        const userId = await getApiUserId(request);
        if (!userId) return fail("未登录", 401);

        const input = parseRecordRestInput(await request.json().catch(() => null));
        if (!input) return fail("参数不完整", 400);

        const { data: execution, error: fetchError } = await supabase
            .from("impromptu_executions")
            .select("id, student_id, status, action_executions")
            .eq("id", input.executionId)
            .single();
        if (fetchError || !execution) return fail("训练记录不存在", 404);
        if (execution.student_id !== userId) return fail("无权限", 403);
        if (!["in_progress", "completed"].includes(String(execution.status || "").toLowerCase())) {
            return fail("这次训练已经结束", 409);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actions = (Array.isArray(execution.action_executions) ? execution.action_executions : []) as any[];
        if (executionActionKey(actions[input.actionIndex]) !== input.actionKey) {
            return fail("训练内容已变化", 409);
        }
        const applied = applyActualRest(actions, input.actionIndex, input.setIndex, input.actualRestSeconds);
        if (!applied.ok) return fail("这一组还没有完成记录", 409);

        const { error: updateError } = await supabase
            .from("impromptu_executions")
            .update({ action_executions: applied.actions, last_saved_at: new Date().toISOString() })
            .eq("id", input.executionId)
            .eq("student_id", userId);
        if (updateError) {
            console.error("record impromptu rest error:", updateError);
            return fail("保存失败", 500);
        }

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
    } catch (error) {
        console.error("record impromptu rest error:", error);
        return fail("服务器错误", 500);
    }
}
