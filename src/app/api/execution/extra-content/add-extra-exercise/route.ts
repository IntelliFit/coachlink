import { NextRequest, NextResponse } from "next/server";
import { getApiUserId } from "@/lib/getApiUserId";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { AddExtraExerciseDto, AddExtraExerciseResponseDto } from "../entity";
import { computeExecutionProgress } from "@/lib/executionProgress";
import { validateExecutionSubscriptionAccess } from "../../_helpers/subscriptionAccess";

/**
 * POST /api/execution/extra-content/add-extra-exercise
 *
 * 添加额外动作（来自学员动作库）
 * - 标记 source: "student_extra"
 * - 记录 source_action_id 关联原始动作
 */
export async function POST(request: NextRequest) {
    try {
        // 1. 验证用户身份
        const userId = await getApiUserId(request);
        if (!userId) {
            return NextResponse.json<ApiData<AddExtraExerciseResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }

        // 2. 解析请求参数
        const body: AddExtraExerciseDto = await request.json();
        const { executionId, actionId, actionName, sets, customData, suggestedTime, notes } = body;

        if (!executionId || !actionId || !actionName) {
            return NextResponse.json<ApiData<AddExtraExerciseResponseDto>>({
                success: false,
                message: "缺少必填参数: executionId, actionId, actionName",
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
            return NextResponse.json<ApiData<AddExtraExerciseResponseDto>>({
                success: false,
                message: "执行记录不存在",
                data: null,
            }, { status: 404 });
        }

        // 4. 验证权限
        if (execution.student_id !== userId) {
            return NextResponse.json<ApiData<AddExtraExerciseResponseDto>>({
                success: false,
                message: "无权访问此记录",
                data: null,
            }, { status: 403 });
        }

        const accessDecision = await validateExecutionSubscriptionAccess({
            instanceId: execution.instance_id,
            studentId: userId,
            dayIndex: execution.day_index,
        });
        if (!accessDecision.allowed) {
            return NextResponse.json<ApiData<AddExtraExerciseResponseDto>>({
                success: false,
                message: accessDecision.message || "无权访问此计划",
                data: null,
            }, { status: accessDecision.status });
        }

        if (String(execution.status || "").toLowerCase() !== "in_progress") {
            return NextResponse.json<ApiData<AddExtraExerciseResponseDto>>({
                success: false,
                message: "训练已结束，不能继续修改动作或组",
                data: null,
            }, { status: 400 });
        }

        // 5. 验证动作存在于学员动作库
        const { data: studentAction } = await supabase
            .from("student_actions")
            .select("id, name, type, attrs")
            .eq("id", actionId)
            .eq("user_id", userId)
            .single();

        if (!studentAction) {
            return NextResponse.json<ApiData<AddExtraExerciseResponseDto>>({
                success: false,
                message: "动作不存在于您的动作库",
                data: null,
            }, { status: 400 });
        }

        // 6. 构建新动作
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actionExecutions = execution.action_executions as any[];
        const newActionIndex = actionExecutions.length;

        // 创建组列表
        const newSets = (sets || [{ weight: null, reps: null }]).map((s, idx) => ({
            set_number: idx + 1,
            set_index: idx,
            planned_weight: s.weight ?? null,
            planned_reps: s.reps ?? null,
            planned_rest_seconds: s.restSeconds ?? 60,
            rest_seconds: s.restSeconds ?? 60,
            status: "pending",
            source: "student_extra",
        }));

        // 创建新动作，标记为学员额外添加
        const newAction = {
            action_index: newActionIndex,
            action_id: actionId,
            action_name: actionName,
            type: studentAction.type || "STRENGTH",
            item_type: studentAction.type || "STRENGTH",
            source: "student_extra",          // 标记来源
            source_action_id: actionId,       // 关联学员动作库
            custom_data: customData || {},
            suggested_time: suggestedTime || null,
            notes: notes || "",
            params: {
                custom_data: customData || {},
                suggested_time: suggestedTime || null,
                note: notes || "",
            },
            sets: newSets,
            total_sets: newSets.length,
            completed_sets: 0,
            created_at: new Date().toISOString(),
        };

        actionExecutions.push(newAction);

        // 7. 更新数据库
        const progress = computeExecutionProgress(actionExecutions);

        const { error: updateError } = await supabase
            .from("plan_instance_executions")
            .update({
                action_executions: actionExecutions,
                total_sets: progress.totalItems,
                last_saved_at: new Date().toISOString(),
            })
            .eq("id", executionId);

        if (updateError) {
            console.error("添加额外动作失败:", updateError);
            return NextResponse.json<ApiData<AddExtraExerciseResponseDto>>({
                success: false,
                message: "更新失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<AddExtraExerciseResponseDto>>({
            success: true,
            message: "成功添加额外动作",
            data: {
                executionId,
                newActionIndex,
                actionName,
                setsCount: newSets.length,
            },
        });
    } catch (error) {
        console.error("添加额外动作失败:", error);
        return NextResponse.json<ApiData<AddExtraExerciseResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
