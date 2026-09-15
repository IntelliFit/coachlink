import { NextResponse } from "next/server";
import { getApiUserId } from "@/lib/getApiUserId";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    CompleteImpromptuSetDto,
    CompleteImpromptuSetResponseDto,
} from "./entity";
import { handleAutoE1RMCheck } from "@/lib/autoE1rmTracking";

export async function POST(req: Request) {
    try {
        const userId = await getApiUserId(req);
        if (!userId) {
            return NextResponse.json<ApiData<CompleteImpromptuSetResponseDto>>({
                success: false,
                message: "用户未登录",
                data: null,
            }, { status: 401 });
        }

        const body = await req.json() as CompleteImpromptuSetDto;
        const { executionId, actionIndex, setIndex, actualWeight, actualReps, notes } =
            body;

        if (!executionId || actionIndex < 0 || setIndex < 0) {
            return NextResponse.json<ApiData<CompleteImpromptuSetResponseDto>>({
                success: false,
                message: "参数不完整",
                data: null,
            }, { status: 400 });
        }

        const { data: execution, error: queryError } = await supabase
            .from("impromptu_executions")
            .select("id, student_id, status, action_executions")
            .eq("id", executionId)
            .single();

        if (queryError || !execution) {
            return NextResponse.json<ApiData<CompleteImpromptuSetResponseDto>>({
                success: false,
                message: "训练记录不存在",
                data: null,
            }, { status: 404 });
        }

        if (execution.student_id !== userId) {
            return NextResponse.json<ApiData<CompleteImpromptuSetResponseDto>>({
                success: false,
                message: "无权限",
                data: null,
            }, { status: 403 });
        }

        const actions = Array.isArray(execution.action_executions)
            ? execution.action_executions
            : [];
        if (!actions[actionIndex]) {
            return NextResponse.json<ApiData<CompleteImpromptuSetResponseDto>>({
                success: false,
                message: "动作不存在",
                data: null,
            }, { status: 400 });
        }

        const currentAction = actions[actionIndex];
        const currentSet = Array.isArray(currentAction?.sets)
            ? currentAction.sets[setIndex]
            : null;
        if (!currentSet) {
            return NextResponse.json<ApiData<CompleteImpromptuSetResponseDto>>({
                success: false,
                message: "组不存在",
                data: null,
            }, { status: 400 });
        }
        // 已结束的训练仍允许修正已经记录过的组，与计划训练的编辑体验保持一致；
        // 但不能借此补录原本未完成的组，避免结束后的训练进度被静默改变。
        if (execution.status === "completed" && currentSet.status !== "completed") {
            return NextResponse.json<ApiData<CompleteImpromptuSetResponseDto>>({
                success: false,
                message: "训练已结束，只能修改已完成的组",
                data: null,
            }, { status: 400 });
        }
        const actionName = String(
            currentAction?.action_name || currentAction?.name || `动作${actionIndex + 1}`,
        ).trim() || `动作${actionIndex + 1}`;
        const actionId = String(currentAction?.action_id || "").trim() || null;

        let autoE1RMResult:
            | { isPR: boolean; e1rm: number; previousPR?: number }
            | null = null;
        if (
            actualWeight !== null && actualWeight !== undefined &&
            actualReps !== null && actualReps !== undefined
        ) {
            autoE1RMResult = await handleAutoE1RMCheck({
                userId,
                actionId,
                actionName,
                weight: Number(actualWeight),
                reps: Number(actualReps),
                executionId,
                setNumber: setIndex + 1,
                sourceType: "impromptu_execution",
            });
        }

        const nowIso = new Date().toISOString();
        const nextActions = actions.map((action: any, idx: number) => {
            if (idx !== actionIndex) return action;
            const sets = Array.isArray(action?.sets) ? action.sets : [];
            const nextSets = sets.map((set: any, sIdx: number) => {
                if (sIdx !== setIndex) return set;
                return {
                    ...set,
                    status: "completed",
                    actual_weight: actualWeight ?? set?.actual_weight ?? null,
                    actual_reps: actualReps ?? set?.actual_reps ?? null,
                    notes: notes ?? set?.notes ?? null,
                    completed_at: nowIso,
                    e1rm: autoE1RMResult?.e1rm ?? set?.e1rm ?? null,
                    is_auto_pr: autoE1RMResult?.isPR || false,
                    planned_weight: set?.planned_weight ?? currentSet?.planned_weight ?? null,
                    planned_reps: set?.planned_reps ?? currentSet?.planned_reps ?? null,
                };
            });
            return {
                ...action,
                sets: nextSets,
                total_sets: nextSets.length,
                completed_sets: nextSets.filter((set: any) =>
                    set?.status === "completed"
                ).length,
            };
        });

        const totalSets = nextActions.reduce(
            (sum: number, action: any) => sum + Number(action?.total_sets || 0),
            0,
        );
        const completedSets = nextActions.reduce(
            (sum: number, action: any) => sum + Number(action?.completed_sets || 0),
            0,
        );

        const { data: updated, error: updateError } = await supabase
            .from("impromptu_executions")
            .update({
                action_executions: nextActions,
                total_sets: totalSets,
                completed_sets: completedSets,
                last_saved_at: nowIso,
            })
            .eq("id", executionId)
            .eq("student_id", userId)
            .select("id, status, action_executions, total_sets, completed_sets")
            .single();

        if (updateError || !updated) {
            return NextResponse.json<ApiData<CompleteImpromptuSetResponseDto>>({
                success: false,
                message: "保存失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<CompleteImpromptuSetResponseDto>>({
            success: true,
            message: "完成组记录成功",
            data: {
                executionId: updated.id,
                completedSets: updated.completed_sets,
                totalSets: updated.total_sets,
                status: updated.status,
                action_executions: updated.action_executions,
                autoE1RM: autoE1RMResult
                    ? {
                        e1rm: autoE1RMResult.e1rm,
                        isPR: autoE1RMResult.isPR,
                        previousPR: autoE1RMResult.previousPR,
                    }
                    : undefined,
            },
        });
    } catch (error) {
        console.error("complete impromptu set error:", error);
        return NextResponse.json<ApiData<CompleteImpromptuSetResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}

