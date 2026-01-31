import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { CompleteSetDto, CompleteSetResponseDto } from "./entity";
import { computeExecutionProgress } from "@/lib/executionProgress";
import { updateEstimatedEndDateForInstance } from "../updateEstimatedEndDate";
import {
    calculateE1RM,
    isNewPR,
    PR_THRESHOLD_KG,
    requiresBodyWeightFallback,
} from "@/lib/e1rmCalculator";

/**
 * Handle auto e1RM calculation and PR detection
 */
async function handleAutoE1RMCheck(params: {
    userId: string;
    actionId: string;
    actionName: string;
    weight: number;
    reps: number;
    executionId: string;
    setNumber: number;
}): Promise<{ isPR: boolean; e1rm: number; previousPR?: number } | null> {
    const {
        userId,
        actionId,
        actionName,
        weight,
        reps,
        executionId,
        setNumber,
    } = params;

    // Basic guard: reps must be present; weight may be negative for bodyweight-including actions (assistance)
    if (
        weight === null || weight === undefined || !Number.isFinite(weight) ||
        !reps || reps <= 0
    ) {
        return null;
    }

    // 1. Determine if body weight is included
    // Check DB first (by name, as actionId might be complex)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: actionConfig } = await (supabase as any)
        .from("coach_actions")
        .select('"includesBodyWeight"')
        .eq("name", actionName)
        .limit(1)
        .maybeSingle();

    let includeBodyWeight: boolean;
    if (actionConfig && actionConfig.includesBodyWeight !== undefined) {
        includeBodyWeight = actionConfig.includesBodyWeight;
    } else {
        includeBodyWeight = requiresBodyWeightFallback(actionName);
    }

    // 2. Get user's body weight if needed
    let bodyWeight = 0;
    if (includeBodyWeight) {
        const { data: profile } = await supabase
            .from("user_profiles")
            .select("weight")
            .eq("user_id", userId)
            .single();
        bodyWeight = profile?.weight || 0;
    }

    // Validate weight according to action type
    if (!includeBodyWeight) {
        if (weight <= 0) return null;
    } else {
        // allow negative/zero external load as long as totalWeight > 0
        if (!bodyWeight || bodyWeight <= 0) return null;
        if (weight + bodyWeight <= 0) return null;
    }

    // 3. Calculate e1RM using 3-formula average
    const result = calculateE1RM({
        weight,
        reps,
        bodyWeight,
        includeBodyWeight,
    });

    const { e1rm, epley, brzycki, lombardi } = result;

    // ------------------------------------------------------------
    // 3.5 Update "current state" snapshot (AUTO_STATE) when change >= 2kg
    // This allows current 1RM to go up OR down based on recent performance,
    // while PR logic remains "only goes up" for achievements.
    // ------------------------------------------------------------
    try {
        const today = new Date().toISOString().split("T")[0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: latestState } = await (supabase as any)
            .from("personal_records_history")
            .select("id, e1rm, date_achieved, created_at")
            .eq("user_id", userId)
            .eq("action_id", actionId)
            .eq("notes", "AUTO_STATE")
            .order("date_achieved", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        const prev = latestState?.e1rm;
        const shouldUpdate = prev === undefined || prev === null
            ? true
            : Math.abs(Number(e1rm) - Number(prev)) >= PR_THRESHOLD_KG;

        if (shouldUpdate) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: todayState } = await (supabase as any)
                .from("personal_records_history")
                .select("id, e1rm")
                .eq("user_id", userId)
                .eq("action_id", actionId)
                .eq("notes", "AUTO_STATE")
                .eq("date_achieved", today)
                .maybeSingle();

            const estimatedFrom = {
                weight,
                reps,
                bodyWeight: includeBodyWeight ? bodyWeight : undefined,
                epley,
                brzycki,
                lombardi,
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const q: any = (supabase as any).from("personal_records_history");
            if (todayState?.id) {
                await q
                    .update({
                        weight,
                        reps,
                        e1rm,
                        estimated_from: estimatedFrom,
                        execution_id: executionId,
                        execution_set_number: setNumber,
                        load_formula:
                            `${weight}kg × ${reps}次 = e1RM ${e1rm}kg`,
                    })
                    .eq("id", todayState.id);
            } else {
                await q.insert({
                    user_id: userId,
                    action_id: actionId,
                    exercise_name: actionName,
                    weight,
                    reps,
                    e1rm,
                    load_formula: `${weight}kg × ${reps}次 = e1RM ${e1rm}kg`,
                    execution_id: executionId,
                    execution_set_number: setNumber,
                    date_achieved: today,
                    is_auto_calculated: true,
                    estimated_from: estimatedFrom,
                    notes: "AUTO_STATE",
                    is_verified: false,
                });
            }
        }
    } catch (e) {
        // best-effort
        console.warn("[e1RM] Failed to update AUTO_STATE:", e);
    }

    // 4. Get current highest PR for this action (prefer action_id match)
    // Use e1rm column (the calculated estimated 1RM)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: currentPR } = await (supabase as any)
        .from("personal_records_history")
        .select("id, e1rm")
        .eq("user_id", userId)
        .eq("action_id", actionId)
        .order("e1rm", { ascending: false })
        .limit(1)
        .maybeSingle();

    // 5. Check if this qualifies as a new PR (must exceed by >2kg)
    if (!isNewPR(e1rm, currentPR?.e1rm)) {
        return { isPR: false, e1rm };
    }

    // 6. Check if there's already a PR for this action TODAY
    const today = new Date().toISOString().split("T")[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const todayPRQuery: any = await (supabase as any)
        .from("personal_records_history")
        .select("id, e1rm")
        .eq("user_id", userId)
        .eq("action_id", actionId)
        .eq("date_achieved", today)
        .eq("is_auto_calculated", true)
        .maybeSingle();
    const todayPR = todayPRQuery.data as
        | { id: string; e1rm: number }
        | null;

    const estimatedFrom = {
        weight,
        reps,
        bodyWeight: includeBodyWeight ? bodyWeight : undefined,
        epley,
        brzycki,
        lombardi,
    };

    if (todayPR) {
        // 7a. Today already has a PR - only update if new e1RM is higher
        if (e1rm > todayPR.e1rm) {
            const { error } = await supabase
                .from("personal_records_history")
                .update({
                    weight: weight, // Source training weight
                    reps: reps, // Source training reps
                    e1rm: e1rm, // Calculated e1RM
                    estimated_from: estimatedFrom,
                    execution_id: executionId,
                    execution_set_number: setNumber,
                    load_formula: `${weight}kg × ${reps}次 = e1RM ${e1rm}kg`,
                })
                .eq("id", todayPR.id);

            if (error) {
                console.error("[e1RM] Failed to update today's PR:", error);
                return { isPR: false, e1rm };
            }

            console.log(
                `[e1RM] Updated today's PR: ${todayPR.e1rm}kg → ${e1rm}kg`,
            );
            return { isPR: true, e1rm, previousPR: todayPR.e1rm };
        }
        // New e1RM is not higher than today's existing PR
        return { isPR: false, e1rm };
    } else {
        // 7b. No PR today - insert new record
        const { error } = await supabase.from("personal_records_history")
            .insert({
                user_id: userId,
                action_id: actionId,
                exercise_name: actionName,
                weight: weight, // Source training weight
                reps: reps, // Source training reps
                e1rm: e1rm, // Calculated e1RM
                load_formula: `${weight}kg × ${reps}次 = e1RM ${e1rm}kg`,
                execution_id: executionId,
                execution_set_number: setNumber,
                date_achieved: today,
                is_auto_calculated: true,
                estimated_from: estimatedFrom,
                is_verified: false,
            });

        if (error) {
            console.error("[e1RM] Failed to insert new PR:", error);
            return { isPR: false, e1rm };
        }

        console.log(
            `[e1RM] New PR created: ${actionName} = ${e1rm}kg (prev: ${
                currentPR?.e1rm || "none"
            })`,
        );
        return { isPR: true, e1rm, previousPR: currentPR?.e1rm };
    }
}

/**
 * POST /api/execution/complete-set
 *
 * 完成一组训练
 */
export async function POST(request: NextRequest) {
    try {
        // 1. 验证用户身份
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<CompleteSetResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }

        const userId = session.user.id;

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
        if (actualWeight && actualReps && actionId) {
            autoE1RMResult = await handleAutoE1RMCheck({
                userId,
                actionId,
                actionName,
                weight: actualWeight,
                reps: actualReps,
                executionId,
                setNumber: setIndex + 1,
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
