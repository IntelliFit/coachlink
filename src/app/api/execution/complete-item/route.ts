import { NextRequest, NextResponse } from "next/server";
import { getApiUserId } from "@/lib/getApiUserId";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { CompleteItemDto, CompleteItemResponseDto } from "./entity";
import { computeExecutionProgress } from "@/lib/executionProgress";
import { updateEstimatedEndDateForInstance } from "../updateEstimatedEndDate";
import { validateExecutionSubscriptionAccess } from "../_helpers/subscriptionAccess";
import { expireTimedOutPlanExecutions } from "@/lib/planExecutionLifecycle";
import { deriveAutomaticExecutionCompletion, retainItemCompletionTime } from "@/lib/executionCompletion";
import { EXECUTION_WRITE_CONFLICT, updateExecutionIfUnchanged } from "../_helpers/conditionalUpdate";

/**
 * POST /api/execution/complete-item
 *
 * 完成一个非力量类型的项目（饮食/有氧/习惯）
 */
export async function POST(request: NextRequest) {
    try {
        // 1. 验证用户身份
        const userId = await getApiUserId(request);
        if (!userId) {
            return NextResponse.json<ApiData<CompleteItemResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }

        // 2. 解析请求参数
        const body: CompleteItemDto = await request.json();
        const {
            executionId,
            actionIndex,
            itemType,
            completed,
            photoUrl,
            actualContent,
            actualDistance,
            actualDuration,
            notes,
        } = body;

        if (!executionId || !Number.isInteger(actionIndex) || actionIndex < 0 ||
            !["DIET", "CARDIO", "HABIT"].includes(itemType) || typeof completed !== "boolean") {
            return NextResponse.json<ApiData<CompleteItemResponseDto>>({
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
            return NextResponse.json<ApiData<CompleteItemResponseDto>>({
                success: false,
                message: "执行记录不存在",
                data: null,
            }, { status: 404 });
        }

        // 4. 验证权限
        if (execution.student_id !== userId) {
            return NextResponse.json<ApiData<CompleteItemResponseDto>>({
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
                message: "这次训练已经结束，不能通过补记项目重新完成",
                data: null,
            }, { status: 409 });
        }

        const accessDecision = await validateExecutionSubscriptionAccess({
            instanceId: execution.instance_id,
            studentId: userId,
            dayIndex: execution.day_index,
        });
        if (!accessDecision.allowed) {
            return NextResponse.json<ApiData<CompleteItemResponseDto>>({
                success: false,
                message: accessDecision.message || "无权访问此计划",
                data: null,
            }, { status: accessDecision.status });
        }

        // 5. 更新 JSONB 数据
        const actionExecutions = structuredClone(execution.action_executions) as any[];

        if (!Array.isArray(actionExecutions) || !actionExecutions[actionIndex]) {
            return NextResponse.json<ApiData<CompleteItemResponseDto>>({
                success: false,
                message: "项目不存在",
                data: null,
            }, { status: 400 });
        }

        // 更新项目数据 - 根据类型保存不同字段
        const nowIso = new Date().toISOString();
        const itemExecution: Record<string, unknown> = {
            status: completed ? "completed" : "pending",
            completed,
            completed_at: retainItemCompletionTime(actionExecutions[actionIndex], completed, nowIso),
            ...(notes !== undefined ? { notes } : {}),
        };

        // DIET 特有字段
        if (itemType === "DIET") {
            if (photoUrl !== undefined) itemExecution.photo_url = photoUrl || null;
            if (actualContent !== undefined) itemExecution.actual_content = actualContent || null;
        }

        // CARDIO 特有字段
        if (itemType === "CARDIO") {
            if (actualDistance !== undefined) itemExecution.actual_distance = actualDistance;
            if (actualDuration !== undefined) itemExecution.actual_duration = actualDuration;
        }

        // 合并到 actionExecutions
        const currentSets = Array.isArray(actionExecutions[actionIndex]?.sets)
            ? [...actionExecutions[actionIndex].sets]
            : null;
        if (currentSets && currentSets[0]) {
            currentSets[0] = {
                ...currentSets[0],
                status: completed ? "completed" : "pending",
                completed_at: retainItemCompletionTime(currentSets[0], completed, nowIso),
                ...(notes !== undefined ? { notes } : {}),
                ...(itemType === "DIET"
                    ? {
                        ...(actualContent !== undefined ? { diet_content: actualContent || null } : {}),
                        ...(photoUrl !== undefined ? { photo_url: photoUrl || null } : {}),
                    }
                    : {}),
                ...(itemType === "CARDIO"
                    ? {
                        ...(actualDistance !== undefined ? { actual_distance: actualDistance } : {}),
                        ...(actualDuration !== undefined ? { actual_duration: actualDuration } : {}),
                    }
                    : {}),
            };
        }

        actionExecutions[actionIndex] = {
            ...actionExecutions[actionIndex],
            ...itemExecution,
            ...(currentSets ? { sets: currentSets } : {}),
        };

        const progress = computeExecutionProgress(actionExecutions as any[]);
        const totalCompletedItems = progress.completedItems;
        const totalItems = progress.totalItems;

        // 6. 保存到数据库
        const shouldAutoComplete = totalItems > 0 &&
            totalCompletedItems >= totalItems;
        const completion = deriveAutomaticExecutionCompletion(execution, shouldAutoComplete, nowIso);

        const { data: savedExecution, error: updateError } = await updateExecutionIfUnchanged({
            client: supabase,
            execution,
            patch: {
                action_executions: actionExecutions,
                completed_sets: totalCompletedItems,
                total_sets: totalItems,
                status: completion.status,
                completed_at: completion.completed_at,
                last_saved_at: nowIso,
            },
        });

        if (updateError) {
            console.error("更新失败:", updateError);
            return NextResponse.json<ApiData<CompleteItemResponseDto>>({
                success: false,
                message: "更新失败",
                data: null,
            }, { status: 500 });
        }
        if (!savedExecution) {
            return NextResponse.json(EXECUTION_WRITE_CONFLICT, { status: 409 });
        }

        if (completion.didComplete && execution.instance_id) {
            updateEstimatedEndDateForInstance(execution.instance_id);
        }

        return NextResponse.json<ApiData<CompleteItemResponseDto>>({
            success: true,
            message: "完成项目成功",
            data: {
                executionId,
                completedItems: totalCompletedItems,
                totalItems,
            },
        });
    } catch (error) {
        console.error("完成项目失败:", error);
        return NextResponse.json<ApiData<CompleteItemResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
