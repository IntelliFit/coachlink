import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { AddExtraSetDto, AddExtraSetResponseDto } from "../entity";
import { computeExecutionProgress } from "@/lib/executionProgress";
import { validateExecutionSubscriptionAccess } from "../../_helpers/subscriptionAccess";

function hasRecordValue(value: unknown): boolean {
    return value !== null && value !== undefined && String(value).trim() !== "";
}

function formatPlanWeight(value: unknown): number | string | null {
    if (!hasRecordValue(value)) return null;
    if (typeof value === "number") {
        return Number.isFinite(value) ? `${value}kg` : null;
    }
    return String(value).trim();
}

function formatPlanReps(value: unknown): number | string | null {
    if (!hasRecordValue(value)) return null;
    if (typeof value === "number") {
        return Number.isFinite(value) ? String(Math.max(0, Math.floor(value))) : null;
    }
    return String(value).trim();
}

function findInheritedSetDefaults(sets: any[]) {
    let fallbackRestSeconds: number | null = null;
    for (let i = sets.length - 1; i >= 0; i -= 1) {
        const set = sets[i] || {};
        const plannedWeight = formatPlanWeight(set.actual_weight ?? set.planned_weight);
        const plannedReps = formatPlanReps(set.actual_reps ?? set.planned_reps);
        const restSeconds = Number(set.planned_rest_seconds ?? set.rest_seconds);
        if (fallbackRestSeconds === null && Number.isFinite(restSeconds) && restSeconds > 0) {
            fallbackRestSeconds = Math.round(restSeconds);
        }
        if (plannedWeight !== null || plannedReps !== null) {
            return {
                plannedWeight,
                plannedReps,
                restSeconds: Number.isFinite(restSeconds) && restSeconds > 0 ? Math.round(restSeconds) : fallbackRestSeconds,
            };
        }
    }
    return { plannedWeight: null, plannedReps: null, restSeconds: fallbackRestSeconds };
}

/**
 * POST /api/execution/extra-content/add-extra-set
 *
 * 在现有动作后添加额外组数
 * - 标记 source: "student_extra"
 */
export async function POST(request: NextRequest) {
    try {
        // 1. 验证用户身份
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<AddExtraSetResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }

        const userId = session.user.id;

        // 2. 解析请求参数
        const body: AddExtraSetDto = await request.json();
        const { executionId, actionIndex, weight, reps, restSeconds } = body;

        if (!executionId || actionIndex === undefined) {
            return NextResponse.json<ApiData<AddExtraSetResponseDto>>({
                success: false,
                message: "缺少必填参数: executionId, actionIndex",
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
            return NextResponse.json<ApiData<AddExtraSetResponseDto>>({
                success: false,
                message: "执行记录不存在",
                data: null,
            }, { status: 404 });
        }

        // 4. 验证权限
        if (execution.student_id !== userId) {
            return NextResponse.json<ApiData<AddExtraSetResponseDto>>({
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
            return NextResponse.json<ApiData<AddExtraSetResponseDto>>({
                success: false,
                message: accessDecision.message || "无权访问此计划",
                data: null,
            }, { status: accessDecision.status });
        }

        if (String(execution.status || "").toLowerCase() !== "in_progress") {
            return NextResponse.json<ApiData<AddExtraSetResponseDto>>({
                success: false,
                message: "训练已结束，不能继续修改动作或组",
                data: null,
            }, { status: 400 });
        }

        // 5. 获取 action_executions 并添加新组
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actionExecutions = execution.action_executions as any[];

        if (!actionExecutions[actionIndex]) {
            return NextResponse.json<ApiData<AddExtraSetResponseDto>>({
                success: false,
                message: "动作不存在",
                data: null,
            }, { status: 400 });
        }

        const action = actionExecutions[actionIndex];
        const currentSets = action.sets || [];
        const newSetIndex = currentSets.length;
        const inherited = findInheritedSetDefaults(currentSets);
        const plannedWeight = formatPlanWeight(weight) ?? inherited.plannedWeight;
        const plannedReps = formatPlanReps(reps) ?? inherited.plannedReps;
        const inheritedRestSeconds = restSeconds ?? inherited.restSeconds ?? 60;

        // 创建新组，标记为学员额外添加
        const newSet = {
            set_number: newSetIndex + 1,
            set_index: newSetIndex,
            planned_weight: plannedWeight,
            planned_reps: plannedReps,
            planned_rest_seconds: inheritedRestSeconds,
            rest_seconds: inheritedRestSeconds,
            status: "pending",
            source: "student_extra",  // 标记来源
            created_at: new Date().toISOString(),
        };

        // 添加到组列表
        currentSets.push(newSet);
        action.sets = currentSets;
        action.total_sets = currentSets.length;

        // 6. 更新数据库
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
            console.error("添加额外组失败:", updateError);
            return NextResponse.json<ApiData<AddExtraSetResponseDto>>({
                success: false,
                message: "更新失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<AddExtraSetResponseDto>>({
            success: true,
            message: "成功添加额外组",
            data: {
                executionId,
                actionIndex,
                newSetIndex,
                totalSets: progress.totalItems,
            },
        });
    } catch (error) {
        console.error("添加额外组失败:", error);
        return NextResponse.json<ApiData<AddExtraSetResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
