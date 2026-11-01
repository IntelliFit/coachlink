import { NextRequest, NextResponse } from "next/server";
import { executionActionKey, isValidActionOrder, reorderExecutionActions } from "@coachlink/core/src/executionActionOrder";
import { getApiUserId } from "@/lib/getApiUserId";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { ReorderImpromptuActionsDto, ReorderImpromptuActionsResponseDto } from "../entity";
import { remapImpromptuSetVideos } from "../../_helpers/reorderSetVideos";

const fail = (message: string, status: number) =>
    NextResponse.json<ApiData<ReorderImpromptuActionsResponseDto>>({
        success: false,
        message,
        data: null,
    }, { status });

/** POST /api/impromptu/extra-content/reorder-actions：调整本次即兴训练的动作顺序。 */
export async function POST(request: NextRequest) {
    try {
        const userId = await getApiUserId(request);
        if (!userId) return fail("未登录", 401);

        const body = await request.json().catch(() => null) as ReorderImpromptuActionsDto | null;
        const executionId = typeof body?.executionId === "string" ? body.executionId.trim() : "";
        if (!executionId) return fail("缺少必填参数", 400);

        const { data: execution } = await supabase
            .from("impromptu_executions")
            .select("*")
            .eq("id", executionId)
            .single();
        if (!execution) return fail("执行记录不存在", 404);
        if (execution.student_id !== userId) return fail("无权访问此记录", 403);
        if (String(execution.status || "").toLowerCase() !== "in_progress") {
            return fail("训练已结束，不能继续修改动作或组", 400);
        }

        const actions = (execution.action_executions || []) as any[];
        const order = body?.order;
        if (!isValidActionOrder(order, actions.length)) return fail("训练内容已变化，请刷新后再调整", 409);
        if (JSON.stringify(actions.map(executionActionKey)) !== JSON.stringify(body?.actionKeys)) {
            return fail("训练内容已变化，请刷新后再调整", 409);
        }

        const remapped = await remapImpromptuSetVideos(supabase, executionId, order);
        if (!remapped) return fail("保存顺序失败，请重试", 500);

        const { error: updateError } = await supabase
            .from("impromptu_executions")
            .update({
                action_executions: reorderExecutionActions(actions, order),
                last_saved_at: new Date().toISOString(),
            })
            .eq("id", executionId)
            .eq("student_id", userId);
        if (updateError) {
            console.error("reorder impromptu actions error:", updateError);
            await remapped.restore();
            return fail("保存顺序失败，请重试", 500);
        }

        return NextResponse.json<ApiData<ReorderImpromptuActionsResponseDto>>({
            success: true,
            message: "已调整顺序",
            data: { executionId, order },
        });
    } catch (error) {
        console.error("reorder impromptu actions error:", error);
        return fail("服务器错误", 500);
    }
}
