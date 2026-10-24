import { NextRequest, NextResponse } from "next/server";
import { isTimedTrainingSet, trainingSetMeasurementPatch } from '@coachlink/core/src/trainingSetMetrics';
import { getApiUserId } from "@/lib/getApiUserId";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { CompleteSetDto, CompleteSetResponseDto } from "./entity";
import { computeExecutionProgress } from "@/lib/executionProgress";
import { updateEstimatedEndDateForInstance } from "../updateEstimatedEndDate";
import { validateExecutionSubscriptionAccess } from "../_helpers/subscriptionAccess";
import { handleAutoE1RMCheck } from "@/lib/autoE1rmTracking";
import { expireTimedOutPlanExecutions } from "@/lib/planExecutionLifecycle";
import { deriveAutomaticExecutionCompletion, retainItemCompletionTime } from "@/lib/executionCompletion";
import { EXECUTION_WRITE_CONFLICT, updateExecutionIfUnchanged } from "../_helpers/conditionalUpdate";

/**
 * POST /api/execution/complete-set
 *
 * 完成一组训练
 */
export async function POST(request: NextRequest) {
    try {
        // 1. 验证用户身份
        const userId = await getApiUserId(request);
        if (!userId) {
            return NextResponse.json<ApiData<CompleteSetResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }

        // 2. 解析请求参数
        const body: CompleteSetDto = await request.json();
        const {
            executionId,
            actionIndex,
            setIndex,
            actionId,
            actualWeight,
            actualReps,
            actualDuration,
            weightUnit,
            weightInput,
            rpe,
            notes,
            is_pr,
            has_video,
        } = body;

        if (
            !executionId || !Number.isInteger(actionIndex) || actionIndex < 0 ||
            !Number.isInteger(setIndex) || setIndex < 0
        ) {
            return NextResponse.json<ApiData<CompleteSetResponseDto>>({
                success: false,
                message: "缺少必填参数",
                data: null,
            }, { status: 400 });
        }

        await expireTimedOutPlanExecutions({ executionId });

        // 3. 获取执行记录
        const { data: execution, error: fetchError } = await supabase
            .from("plan_instance_executions")
            .select("*")
            .eq("id", executionId)
            .single();

        if (fetchError || !execution) {
            return NextResponse.json<ApiData<CompleteSetResponseDto>>({
                success: false,
                message: "执行记录不存在",
                data: null,
            }, { status: 404 });
        }

        // 4. 验证权限
        if (execution.student_id !== userId) {
            return NextResponse.json<ApiData<CompleteSetResponseDto>>({
                success: false,
                message: "无权访问此记录",
                data: null,
            }, { status: 403 });
        }
        if (String(execution.status || "").toLowerCase() === "timed_out") {
            return NextResponse.json({
                success: false,
                code: "EXECUTION_TIMED_OUT",
                message: "本次训练已超过5小时，请返回今日训练重新开始这一天",
            }, { status: 409 });
        }
        if (!["in_progress", "completed"].includes(execution.status)) {
            return NextResponse.json({
                success: false,
                code: "EXECUTION_NOT_EDITABLE",
                message: "这次训练已经结束，不能通过补组重新完成",
                data: null,
            }, { status: 409 });
        }

        const accessDecision = await validateExecutionSubscriptionAccess({
            instanceId: execution.instance_id,
            studentId: userId,
            dayIndex: execution.day_index,
        });
        if (!accessDecision.allowed) {
            return NextResponse.json<ApiData<CompleteSetResponseDto>>({
                success: false,
                message: accessDecision.message || "无权访问此计划",
                data: null,
            }, { status: accessDecision.status });
        }

        // 4.5 查询视频URL（如果has_video为true）
        let video_url: string | null = null;
        if (has_video && actionId) {
            const { data: videoRecord } = await supabase
                .from("execution_set_videos")
                .select("video_url")
                .eq("execution_id", executionId)
                .eq("action_id", actionId)
                .eq("set_number", setIndex + 1)
                .maybeSingle();

            if (videoRecord) {
                video_url = videoRecord.video_url;
            }
        }

        // 5. 更新 JSONB 数据
        const actionExecutions = structuredClone(execution.action_executions) as any[];

        if (
            !Array.isArray(actionExecutions) ||
            !actionExecutions[actionIndex]?.sets?.[setIndex]
        ) {
            return NextResponse.json<ApiData<CompleteSetResponseDto>>({
                success: false,
                message: "组不存在",
                data: null,
            }, { status: 400 });
        }

        // Get action name for e1RM calculation
        const actionName = actionExecutions[actionIndex].action_name ||
            actionExecutions[actionIndex].name ||
            "未知动作";

        // 更新组数据 - 包含is_pr, has_video, video_url, and e1RM info
        const nowIso = new Date().toISOString();
        const originalSet = actionExecutions[actionIndex].sets[setIndex];
        const timed = isTimedTrainingSet(originalSet, actionExecutions[actionIndex]);
        const measurements = trainingSetMeasurementPatch(originalSet, { actualWeight, actualReps, actualDuration, weightUnit, weightInput }, actionExecutions[actionIndex]);
        if (measurements.error) {
            return NextResponse.json({ success: false, message: measurements.error, data: null }, { status: 400 });
        }
        // lbs input is converted server-side, so everything below works from the canonical kg value.
        const canonicalWeight: number | null | undefined = "actual_weight" in measurements.patch
            ? measurements.patch.actual_weight
            : actualWeight;
        const measurementsChanged =
            (canonicalWeight !== undefined && canonicalWeight !== originalSet.actual_weight) ||
            (actualReps !== undefined && actualReps !== originalSet.actual_reps) ||
            (actualDuration !== undefined && actualDuration !== originalSet.actual_duration);
        actionExecutions[actionIndex].sets[setIndex] = {
            ...originalSet,
            status: "completed",
            ...measurements.patch,
            ...(rpe !== undefined ? { rpe } : {}),
            ...(notes !== undefined ? { notes } : {}),
            ...(is_pr !== undefined ? { is_pr } : {}),
            ...(has_video !== undefined ? {
                has_video,
                video_url: has_video ? video_url || originalSet.video_url || null : null,
            } : {}),
            completed_at: retainItemCompletionTime(originalSet, true, nowIso),
            ...(measurementsChanged ? { e1rm: null, is_auto_pr: false } : {}),
        };

        // 更新动作已完成组数
        actionExecutions[actionIndex].completed_sets =
            actionExecutions[actionIndex].sets.filter(
                (s: any) => s.status === "completed",
            ).length;

        // 计算总完成组数
        const progress = computeExecutionProgress(actionExecutions as any[]);
        const totalCompletedSets = progress.completedItems;
        const totalSets = progress.totalItems;

        // 6. 保存到数据库
        const shouldAutoComplete = totalSets > 0 &&
            totalCompletedSets >= totalSets;
        const completion = deriveAutomaticExecutionCompletion(execution, shouldAutoComplete, nowIso);

        const { data: savedExecution, error: updateError } = await updateExecutionIfUnchanged({
            client: supabase,
            execution,
            patch: {
                action_executions: actionExecutions,
                completed_sets: totalCompletedSets,
                total_sets: totalSets,
                status: completion.status,
                completed_at: completion.completed_at,
                last_saved_at: nowIso,
            },
        });

        if (updateError) {
            console.error("更新失败:", updateError);
            return NextResponse.json<ApiData<CompleteSetResponseDto>>({
                success: false,
                message: "更新失败",
                data: null,
            }, { status: 500 });
        }
        if (!savedExecution) {
            return NextResponse.json(EXECUTION_WRITE_CONFLICT, { status: 409 });
        }

        // Only a new completion changes progression/entitlement, not historical edits.
        if (completion.didComplete && execution.instance_id) {
            updateEstimatedEndDateForInstance(execution.instance_id);
        }

        // PR side effects must follow a successful save, never a rejected stale write.
        let autoE1RMResult: { isPR: boolean; e1rm: number; previousPR?: number } | null = null;
        if (!timed && canonicalWeight !== undefined && canonicalWeight !== null && actualReps && actionId) {
            try {
                const { data: instanceRow } = await supabase
                    .from("coach_plan_instances")
                    .select("coach_subscription_id")
                    .eq("id", execution.instance_id)
                    .maybeSingle();
                autoE1RMResult = await handleAutoE1RMCheck({
                    userId, actionId, actionName, weight: canonicalWeight, reps: actualReps,
                    executionId, setNumber: setIndex + 1,
                    isCoachSubscriptionPlan: !!instanceRow?.coach_subscription_id,
                });
                if (autoE1RMResult) {
                    const enriched = structuredClone(savedExecution.action_executions) as any[];
                    Object.assign(enriched[actionIndex].sets[setIndex], {
                        e1rm: autoE1RMResult.e1rm, is_auto_pr: autoE1RMResult.isPR,
                    });
                    // Optional enrichment must not overwrite a newer save or finish.
                    const enrichment = await updateExecutionIfUnchanged({
                        client: supabase, execution: savedExecution,
                        patch: { action_executions: enriched },
                    });
                    if (enrichment.error) console.warn("[complete-set] e1RM enrichment failed", enrichment.error);
                }
            } catch (error) {
                console.warn("[complete-set] saved successfully; e1RM enrichment skipped", error);
            }
        }

        return NextResponse.json<ApiData<CompleteSetResponseDto>>({
            success: true,
            message: "完成组成功",
            data: {
                executionId,
                completedSets: totalCompletedSets,
                totalSets: totalSets,
                // Include auto e1RM result for frontend celebration
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
        console.error("完成组失败:", error);
        return NextResponse.json<ApiData<CompleteSetResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
