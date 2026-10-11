import { NextRequest, NextResponse } from "next/server";
import { getPlannedDurationSeconds, isTimedTrainingSet } from '@coachlink/core/src/trainingSetMetrics';
import { getApiUserId } from "@/lib/getApiUserId";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { FinishTrainingDto, FinishTrainingResponseDto } from "./entity";
import { updateEstimatedEndDateForInstance } from "../updateEstimatedEndDate";
import { computeExecutionProgress } from "@/lib/executionProgress";
import { validateExecutionSubscriptionAccess } from "../_helpers/subscriptionAccess";
import { attachWorkoutEnergyEstimate } from "@/lib/workoutEnergyExecution";
import type { WorkoutEnergyEstimate } from "@/lib/workoutEnergy";
import { EXECUTION_WRITE_CONFLICT, updateExecutionIfUnchanged } from "../_helpers/conditionalUpdate";
import {
    activatePendingPlanRevisionForSource,
    expireTimedOutPlanExecutions,
    PLAN_EXECUTION_HARD_TIMEOUT_MS,
} from "@/lib/planExecutionLifecycle";

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

const getLateCompletionTimestamp = (execution: any): string => {
    const startedAt = new Date(execution?.started_at || "").getTime();
    if (!Number.isFinite(startedAt)) return new Date().toISOString();

    const timeoutAt = startedAt + PLAN_EXECUTION_HARD_TIMEOUT_MS;
    const lastSavedAt = new Date(execution?.last_saved_at || "").getTime();
    const endedAt = new Date(execution?.ended_at || "").getTime();
    const hasRecordedProgress = Number(execution?.completed_sets || 0) > 0;
    const preferredAt = hasRecordedProgress && Number.isFinite(lastSavedAt) && lastSavedAt > startedAt
        ? lastSavedAt
        : Number.isFinite(endedAt) && endedAt > startedAt
            ? endedAt
            : timeoutAt;

    return new Date(Math.min(Math.max(preferredAt, startedAt), timeoutAt)).toISOString();
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

        await expireTimedOutPlanExecutions({ executionId });

        // 验证权限并获取 instance_id
        const { data: execution } = await supabase
            .from("plan_instance_executions")
            .select(
                "id, student_id, day_index, completed_sets, total_sets, instance_id, action_executions, started_at, completed_at, ended_at, last_saved_at, session_notes, status, updated_at",
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
        const executionStatus = String(execution.status || "").toLowerCase();
        if (executionStatus === "completed") {
            return NextResponse.json<ApiData<FinishTrainingResponseDto>>({
                success: true,
                message: "训练已经完成",
                data: {
                    id: execution.id,
                    status: execution.status,
                    completed_at: execution.completed_at,
                    completed_sets: execution.completed_sets,
                    total_sets: execution.total_sets,
                    action_executions: execution.action_executions as any[],
                    energy_estimate: null,
                },
            });
        }
        if (executionStatus !== "in_progress" && executionStatus !== "timed_out") {
            return NextResponse.json({
                success: false,
                code: "EXECUTION_NOT_FINISHABLE",
                message: "这次训练已经结束，不能再次完成",
            }, { status: 409 });
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

        const isLateCompletion = executionStatus === "timed_out";
        const nowIso = isLateCompletion
            ? getLateCompletionTimestamp(execution)
            : new Date().toISOString();
        const updatePayload: Record<string, unknown> = {
            status: "completed",
            completed_at: nowIso,
            session_notes: sessionNotes === undefined
                ? execution.session_notes
                : sessionNotes || null,
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

        // Late confirmation preserves recorded content; quick mode cannot fill
        // missing sets in an already timed-out workout.
        if (mode === "quick" && !isLateCompletion) {
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
                        const timed = isTimedTrainingSet(set, action);
                        return {
                            ...set,
                            status: "completed",
                            actual_weight: timed ? null : set?.actual_weight ?? defaultWeight ?? null,
                            actual_reps: timed ? null : set?.actual_reps ?? defaultReps ?? null,
                            ...(timed ? { actual_duration: set?.actual_duration ?? getPlannedDurationSeconds(set, action), e1rm: null, is_auto_pr: false } : {}),
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

        let data: any = null;
        let error: any = null;
        if (isLateCompletion) {
            // A late confirmation and any untouched replacement attempt must
            // be reconciled atomically so the blank attempt cannot hide the
            // student's real workout.
            const rpcResult = await (serviceRoleSupabase as any).rpc(
                "complete_plan_execution_atomic",
                {
                    p_execution_id: executionId,
                    p_student_id: userId,
                    p_completed_at: nowIso,
                    p_session_notes: updatePayload.session_notes,
                    p_action_executions: Object.prototype.hasOwnProperty.call(updatePayload, "action_executions")
                        ? updatePayload.action_executions
                        : null,
                    p_completed_sets: Number(updatePayload.completed_sets ?? execution.completed_sets ?? 0),
                    p_total_sets: Number(updatePayload.total_sets ?? execution.total_sets ?? 0),
                    p_last_saved_at: Object.prototype.hasOwnProperty.call(updatePayload, "last_saved_at")
                        ? updatePayload.last_saved_at
                        : null,
                },
            );
            error = rpcResult.error;
            data = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
        } else {
            // Normal in-progress completion stays independent from the new
            // late-completion migration and keeps the existing fast path.
            const updateResult = await updateExecutionIfUnchanged({
                client: supabase,
                execution,
                patch: updatePayload,
            });
            error = updateResult.error;
            data = updateResult.data;
            if (!error && !data) {
                const { data: current, error: currentError } = await supabase
                    .from("plan_instance_executions")
                    .select("*")
                    .eq("id", executionId)
                    .eq("student_id", userId)
                    .maybeSingle();
                if (!currentError && current?.status === "completed") {
                    return NextResponse.json<ApiData<FinishTrainingResponseDto>>({
                        success: true,
                        message: "训练已经完成",
                        data: {
                            id: current.id, status: current.status,
                            completed_at: current.completed_at,
                            completed_sets: current.completed_sets, total_sets: current.total_sets,
                            action_executions: current.action_executions as any[], energy_estimate: null,
                        },
                    });
                }
                return NextResponse.json(EXECUTION_WRITE_CONFLICT, { status: 409 });
            }
        }

        if (error || !data) {
            const errorMessage = String(error?.message || "");
            if (errorMessage.includes("ACTIVE_ATTEMPT_HAS_PROGRESS")) {
                return NextResponse.json({
                    success: false,
                    code: "ACTIVE_ATTEMPT_HAS_PROGRESS",
                    message: "这一天已有另一条训练记录了内容，请返回今日训练处理当前记录",
                }, { status: 409 });
            }
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
            try {
                await activatePendingPlanRevisionForSource({
                    sourceInstanceId: execution.instance_id,
                });
            } catch (activationError) {
                console.error("[execution/finish] pending revision activation failed:", activationError);
            }
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
