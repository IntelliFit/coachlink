import { NextRequest, NextResponse } from "next/server";
import { getApiUserId } from "@/lib/getApiUserId";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { CompleteSetDto, CompleteSetResponseDto } from "./entity";
import { computeExecutionProgress } from "@/lib/executionProgress";
import { updateEstimatedEndDateForInstance } from "../updateEstimatedEndDate";
import { validateExecutionSubscriptionAccess } from "../_helpers/subscriptionAccess";
import { handleAutoE1RMCheck } from "@/lib/autoE1rmTracking";
import { expireTimedOutPlanExecutions } from "@/lib/planExecutionLifecycle";

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
            rpe,
            notes,
            is_pr,
            has_video,
        } = body;

        if (
            !executionId || actionIndex === undefined || setIndex === undefined
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
        console.log("[complete-set] Input:", {
            actionId,
            has_video,
            is_pr,
            setIndex,
        });

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
        const actionExecutions = execution.action_executions as any[];

        if (
            !actionExecutions[actionIndex] ||
            !actionExecutions[actionIndex].sets[setIndex]
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

        // 5.5 Auto e1RM calculation and PR detection
        let autoE1RMResult:
            | { isPR: boolean; e1rm: number; previousPR?: number }
            | null = null;
        let isCoachSubscriptionPlan = false;
        if (execution.instance_id) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: instanceRow } = await (supabase as any)
                .from("plan_instances")
                .select("coach_subscription_id")
                .eq("id", execution.instance_id)
                .maybeSingle();
            isCoachSubscriptionPlan = !!instanceRow?.coach_subscription_id;
        }

        if (actualWeight && actualReps && actionId) {
            autoE1RMResult = await handleAutoE1RMCheck({
                userId,
                actionId,
                actionName,
                weight: actualWeight,
                reps: actualReps,
                executionId,
                setNumber: setIndex + 1,
                isCoachSubscriptionPlan,
            });
        }

        // 更新组数据 - 包含is_pr, has_video, video_url, and e1RM info
        actionExecutions[actionIndex].sets[setIndex] = {
            ...actionExecutions[actionIndex].sets[setIndex],
            status: "completed",
            actual_weight: actualWeight,
            actual_reps: actualReps,
            rpe,
            notes: notes || "",
            is_pr: is_pr || false,
            has_video: has_video || false,
            video_url: video_url,
            completed_at: new Date().toISOString(),
            // Add e1RM info for reference
            e1rm: autoE1RMResult?.e1rm,
            is_auto_pr: autoE1RMResult?.isPR || false,
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
        const nowIso = new Date().toISOString();
        const shouldAutoComplete = totalSets > 0 &&
            totalCompletedSets >= totalSets;

        const { error: updateError } = await supabase
            .from("plan_instance_executions")
            .update({
                action_executions: actionExecutions,
                completed_sets: totalCompletedSets,
                total_sets: totalSets,
                status: shouldAutoComplete ? "completed" : execution.status,
                completed_at: shouldAutoComplete
                    ? nowIso
                    : execution.completed_at,
                last_saved_at: new Date().toISOString(),
            })
            .eq("id", executionId);

        if (updateError) {
            console.error("更新失败:", updateError);
            return NextResponse.json<ApiData<CompleteSetResponseDto>>({
                success: false,
                message: "更新失败",
                data: null,
            }, { status: 500 });
        }

        // If we auto-completed the execution, refresh subscription estimated end date (B1 credits-driven).
        if (shouldAutoComplete && execution.instance_id) {
            updateEstimatedEndDateForInstance(execution.instance_id);
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
