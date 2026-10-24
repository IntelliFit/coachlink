import { NextRequest, NextResponse } from "next/server";
import { inheritedTimedSetDefaults, isTimedTrainingSet } from '@coachlink/core/src/trainingSetMetrics';
import { inheritedPlannedWeightUnit } from '@coachlink/core/src/weightUnit';
import { getApiUserId } from "@/lib/getApiUserId";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    AddImpromptuExtraSetDto,
    AddImpromptuExtraSetResponseDto,
} from "../entity";
import { computeExecutionProgress } from "@/lib/executionProgress";

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
                weightUnitFields: plannedWeight !== null ? inheritedPlannedWeightUnit(set) : {},
                plannedReps,
                restSeconds: Number.isFinite(restSeconds) && restSeconds > 0 ? Math.round(restSeconds) : fallbackRestSeconds,
            };
        }
    }
    return { plannedWeight: null, weightUnitFields: {}, plannedReps: null, restSeconds: fallbackRestSeconds };
}

export async function POST(request: NextRequest) {
    try {
        const userId = await getApiUserId(request);
        if (!userId) {
            return NextResponse.json<ApiData<AddImpromptuExtraSetResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }
        const body: AddImpromptuExtraSetDto = await request.json();
        const { executionId, actionIndex, weight, weightUnit, weightInput, reps, restSeconds } = body;
        if (!executionId || actionIndex === undefined) {
            return NextResponse.json<ApiData<AddImpromptuExtraSetResponseDto>>({
                success: false,
                message: "缺少必填参数",
                data: null,
            }, { status: 400 });
        }

        const { data: execution } = await supabase
            .from("impromptu_executions")
            .select("*")
            .eq("id", executionId)
            .single();
        if (!execution) {
            return NextResponse.json<ApiData<AddImpromptuExtraSetResponseDto>>({
                success: false,
                message: "执行记录不存在",
                data: null,
            }, { status: 404 });
        }
        if (execution.student_id !== userId) {
            return NextResponse.json<ApiData<AddImpromptuExtraSetResponseDto>>({
                success: false,
                message: "无权访问此记录",
                data: null,
            }, { status: 403 });
        }

        if (String(execution.status || "").toLowerCase() !== "in_progress") {
            return NextResponse.json<ApiData<AddImpromptuExtraSetResponseDto>>({
                success: false,
                message: "训练已结束，不能继续修改动作或组",
                data: null,
            }, { status: 400 });
        }

        const actionExecutions = (execution.action_executions || []) as any[];
        if (!actionExecutions[actionIndex]) {
            return NextResponse.json<ApiData<AddImpromptuExtraSetResponseDto>>({
                success: false,
                message: "动作不存在",
                data: null,
            }, { status: 400 });
        }

        const action = actionExecutions[actionIndex];
        const sets = Array.isArray(action.sets) ? action.sets : [];
        const newSetIndex = sets.length;
        const inherited = findInheritedSetDefaults(sets);
        const plannedWeight = formatPlanWeight(weight) ?? inherited.plannedWeight;
        const plannedReps = formatPlanReps(reps) ?? inherited.plannedReps;
        const inheritedRestSeconds = restSeconds ?? inherited.restSeconds ?? 60;
        const clientLbs = weightUnit === "lbs" && weightInput !== null && weightInput !== undefined && Number.isFinite(Number(weightInput));
        const plannedWeightUnitFields = clientLbs
            ? { planned_weight_unit: "lbs", planned_weight_input: Number(weightInput) }
            : formatPlanWeight(weight) === null ? inherited.weightUnitFields : {};
        sets.push({
            set_number: newSetIndex + 1,
            set_index: newSetIndex,
            planned_weight: plannedWeight,
            ...plannedWeightUnitFields,
            planned_reps: plannedReps,
            ...inheritedTimedSetDefaults([...sets].reverse().find((s: any) => isTimedTrainingSet(s, action)), action),
            planned_rest_seconds: inheritedRestSeconds,
            rest_seconds: inheritedRestSeconds,
            status: "pending",
            source: "student_extra",
            created_at: new Date().toISOString(),
        });
        action.sets = sets;
        action.total_sets = sets.length;

        const progress = computeExecutionProgress(actionExecutions);
        const { error: updateError } = await supabase
            .from("impromptu_executions")
            .update({
                action_executions: actionExecutions,
                total_sets: progress.totalItems,
                last_saved_at: new Date().toISOString(),
            })
            .eq("id", executionId)
            .eq("student_id", userId);

        if (updateError) {
            return NextResponse.json<ApiData<AddImpromptuExtraSetResponseDto>>({
                success: false,
                message: "更新失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<AddImpromptuExtraSetResponseDto>>({
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
        console.error("add impromptu extra set error:", error);
        return NextResponse.json<ApiData<AddImpromptuExtraSetResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}

