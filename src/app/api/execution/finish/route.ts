import { NextRequest, NextResponse } from "next/server";
import { getApiUserId } from "@/lib/getApiUserId";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { FinishTrainingDto, FinishTrainingResponseDto } from "./entity";
import { updateEstimatedEndDateForInstance } from "../updateEstimatedEndDate";
import { computeExecutionProgress } from "@/lib/executionProgress";
import { validateExecutionSubscriptionAccess } from "../_helpers/subscriptionAccess";
import { attachWorkoutEnergyEstimate } from "@/lib/workoutEnergyExecution";
import type { WorkoutEnergyEstimate } from "@/lib/workoutEnergy";

const parseMinNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const match = String(value).match(/-?\d+(\.\d+)?/);
    if (!match) return null;
    const num = Number(match[0]);
    return Number.isFinite(num) ? num : null;
};

const parseMinReps = (value: unknown): number | null => {
    const num = parseMinNumber(value);
    if (num === null) return null;
    return Math.max(0, Math.floor(num));
};

const parseMinWeight = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const raw = String(value).toLowerCase();
    if (!raw) return null;
    if (raw.includes("rm") || raw.includes("%") || raw.includes("rpe")) return null;
    return parseMinNumber(raw);
};

/**
 * POST /api/execution/finish
 *
 * 完成训练
 */
export async function POST(request: NextRequest) {
    try {
        const userId = await getApiUserId(request);
        if (!userId) {
            return NextResponse.json<ApiData<FinishTrainingResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }

        const body: FinishTrainingDto = await request.json();
        const { executionId, sessionNotes, mode } = body;

        if (!executionId) {
            return NextResponse.json<ApiData<FinishTrainingResponseDto>>({
                success: false,
                message: "缺少执行ID",
                data: null,
            }, { status: 400 });
        }

        // 验证权限并获取 instance_id
        const { data: execution } = await supabase
            .from("plan_instance_executions")
            .select(
                "student_id, day_index, completed_sets, total_sets, instance_id, action_executions, started_at",
            )
            .eq("id", executionId)
            .single();

        if (!execution || execution.student_id !== userId) {
            return NextResponse.json<ApiData<FinishTrainingResponseDto>>({
                success: false,
                message: "无权限",
                data: null,
            }, { status: 403 });
        }

        const accessDecision = await validateExecutionSubscriptionAccess({
            instanceId: execution.instance_id,
            studentId: userId,
            dayIndex: execution.day_index,
        });
        if (!accessDecision.allowed) {
            return NextResponse.json<ApiData<FinishTrainingResponseDto>>({
                success: false,
                message: accessDecision.message || "无权访问此计划",
                data: null,
            }, { status: accessDecision.status });
        }

        const nowIso = new Date().toISOString();
        const updatePayload: Record<string, unknown> = {
            status: "completed",
            completed_at: nowIso,
            session_notes: sessionNotes || null,
        };
        const rawActions = execution.action_executions;
        let finalizedActions: any[] = [];
        if (Array.isArray(rawActions)) {
            finalizedActions = rawActions;
        } else if (typeof rawActions === "string") {
            try {
                const parsed = JSON.parse(rawActions);
                finalizedActions = Array.isArray(parsed) ? parsed : [];
            } catch {
                finalizedActions = [];
            }
        }

        if (mode === "quick") {
            const completedAt = nowIso;
            finalizedActions = finalizedActions.map((action) => {
                const sets = Array.isArray(action?.sets) ? action.sets : null;
                if (sets) {
                    const nextSets = sets.map((set: any) => {
                        const alreadyCompleted = set?.status === "completed";
                        if (alreadyCompleted) {
                            return set;
                        }
                        const defaultWeight = parseMinWeight(set?.planned_weight);
                        const defaultReps = parseMinReps(set?.planned_reps);
                        return {
                            ...set,
                            status: "completed",
                            actual_weight: set?.actual_weight ?? defaultWeight ?? null,
                            actual_reps: set?.actual_reps ?? defaultReps ?? null,
                            completed_at: set?.completed_at ?? completedAt,
                        };
                    });
                    return {
                        ...action,
                        sets: nextSets,
                        total_sets: nextSets.length,
                        completed_sets: nextSets.filter((s: any) => s?.status === "completed").length,
                    };
                }

                return {
                    ...action,
                    status: "completed",
                    completed: true,
                    completed_at: action?.completed_at ?? completedAt,
                };
            });

            const progress = computeExecutionProgress(finalizedActions);
            updatePayload.action_executions = finalizedActions;
            updatePayload.completed_sets = progress.completedItems;
            updatePayload.total_sets = progress.totalItems;
            updatePayload.last_saved_at = nowIso;
        }

        let energyEstimate: WorkoutEnergyEstimate | null = null;
        try {
            const energyResult = await attachWorkoutEnergyEstimate({
                db: supabase,
                userId,
                startedAt: execution.started_at,
                completedAt: nowIso,
                actionExecutions: finalizedActions,
            });
            energyEstimate = energyResult.estimate;
            if (energyEstimate) {
                finalizedActions = energyResult.actionExecutions;
                updatePayload.action_executions = finalizedActions;
            }
        } catch (energyError) {
            console.warn("[execution/finish] calorie estimate skipped:", energyError);
        }

        // 更新状态
        const { data, error } = await supabase
            .from("plan_instance_executions")
            .update(updatePayload)
            .eq("id", executionId)
            .select()
            .single();

        if (error) {
            console.error("完成训练失败:", error);
            return NextResponse.json<ApiData<FinishTrainingResponseDto>>({
                success: false,
                message: "更新失败",
                data: null,
            }, { status: 500 });
        }

        // 异步更新订阅的预计完成日期
        if (execution.instance_id) {
            updateEstimatedEndDateForInstance(execution.instance_id);
        }

        return NextResponse.json<ApiData<FinishTrainingResponseDto>>({
            success: true,
            message: "完成训练成功",
            data: {
                id: data.id,
                status: data.status,
                completed_at: data.completed_at,
                completed_sets: data.completed_sets,
                total_sets: data.total_sets,
                action_executions: data.action_executions,
                energy_estimate: energyEstimate,
            },
        });
    } catch (error) {
        console.error("完成训练失败:", error);
        return NextResponse.json<ApiData<FinishTrainingResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
