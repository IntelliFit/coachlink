import supabase from "@/lib/supabaseClient";
import { computeExecutionProgress } from "@/lib/executionProgress";
import { formatKgForGym } from "@/lib/weightQuantize";
import {
    calcIntensityDisplay,
    hasDynamicIntensityTarget,
    normalizeIntensityConfig,
} from "@/lib/rmCaculator";
import { normalizeToKg } from "@/types/intensity";
import { getCurrent1RMRecords } from "@/app/api/student/get-current-1rm/route";

type ExecutionRecord = {
    id: string;
    instance_id: string;
    student_id: string;
    day_index: number;
    status: string;
    action_executions: any[];
    total_sets: number;
    completed_sets: number;
    [key: string]: any;
};

type PlanningContext = {
    masterActionSets: any[];
    actionsMap: Record<string, any>;
    bodyWeight: number;
    oneRMMap: Record<string, number>;
};

function resolveActionId(actionSet: any) {
    return actionSet?.action_id || actionSet?.actionId || null;
}

function resolveMasterPlanFields(actionSet: any, context: PlanningContext) {
    const actionId = resolveActionId(actionSet);
    const actionMeta = actionId ? context.actionsMap[actionId] : null;
    const params = actionSet?.params || {};
    const reps = params?.["次数"] || actionSet?.reps || null;
    const restSeconds =
        params?.["休息时间"] ?? actionSet?.rest_seconds ?? 90;
    const intensityConfig = normalizeIntensityConfig(params);
    const legacyRm = params?.["强度"] ?? actionSet?.intensity;

    let load = params?.load;
    const shouldRefreshExistingLoad = hasDynamicIntensityTarget({
        intensityConfig,
        legacyRm,
    });
    // 与 today-training/get-instance 对齐：
    // 动态强度（RM/%）每次同步时按当前 1RM 重算；
    // 固定重量才直接沿用实例里已有 load。
    if (shouldRefreshExistingLoad || load === null || load === undefined) {
        const actionNameForLookup =
            actionMeta?.name ||
            actionSet?.actionName ||
            actionSet?.set_name ||
            "";
        const canonicalActionId = actionMeta?.canonical_action_id;
        const oneRM = context.oneRMMap[canonicalActionId] ??
            context.oneRMMap[actionNameForLookup] ??
            (actionId ? context.oneRMMap[actionId] : undefined) ??
            undefined;
        const includesBodyWeight = !!actionMeta?.includesBodyWeight;
        const loadResult = calcIntensityDisplay({
            intensityConfig,
            legacyRm,
            oneRM,
            bodyWeight: context.bodyWeight,
            includesBodyWeight,
        });

        if (
            loadResult.displayWeight !== null &&
            loadResult.displayWeight !== undefined
        ) {
            load = normalizeToKg(
                Number(loadResult.displayWeight),
                loadResult.displayUnit || "kg",
            );
        }
    }

    return {
        actionId,
        actionName:
            actionMeta?.name ||
            actionSet?.actionName ||
            actionSet?.set_name ||
            "未知动作",
        itemType: String(
            actionSet?.itemType ||
                actionMeta?.type ||
                "STRENGTH",
        ).toUpperCase(),
        plannedWeight:
            load !== null && load !== undefined
                ? formatKgForGym(Number(load))
                : legacyRm
                  ? `${legacyRm}RM`
                  : null,
        plannedReps: reps ? `${reps}` : null,
        plannedRestSeconds:
            restSeconds === null || restSeconds === undefined
                ? null
                : Number(restSeconds),
    };
}

async function loadPlanningContext(params: {
    instanceId: string;
    dayIndex: number;
    userId: string;
}): Promise<PlanningContext | null> {
    const { instanceId, dayIndex, userId } = params;

    const { data: masterInstance } = await supabase
        .from("coach_plan_instances")
        .select("training_days")
        .eq("id", instanceId)
        .maybeSingle();

    const masterDays = masterInstance?.training_days as any[] | undefined;
    const masterDay = masterDays?.find((day: any) => Number(day?.dayIndex) === Number(dayIndex));
    const masterActionSets = masterDay?.actionSets || [];

    if (!masterDay || masterActionSets.length === 0) {
        return null;
    }

    const actionIds = masterActionSets
        .map((actionSet: any) => resolveActionId(actionSet))
        .filter((id: string | null): id is string => !!id);
    const actionsMap: Record<string, any> = {};
    const oneRMMap: Record<string, number> = {};
    let bodyWeight = 0;

    if (actionIds.length > 0) {
        const { data: coachActionsData } = await supabase
            .from("coach_actions")
            .select('id, name, type, canonical_action_id, "includesBodyWeight"')
            .in("id", actionIds);

        for (const action of coachActionsData || []) {
            actionsMap[action.id] = action;
        }

        const remainingIds = actionIds.filter((id) => !actionsMap[id]);
        if (remainingIds.length > 0) {
            const { data: studentActionsData } = await supabase
                .from("student_actions")
                .select("id, name, type, canonical_action_id, includes_body_weight")
                .in("id", remainingIds);

            for (const action of studentActionsData || []) {
                actionsMap[action.id] = {
                    ...action,
                    canonical_action_id: action.canonical_action_id,
                    includesBodyWeight: action.includes_body_weight,
                };
            }
        }
    }

    const actionNames = Array.from(
        new Set(
            masterActionSets
                .map((actionSet: any) => {
                    const actionId = resolveActionId(actionSet);
                    return String(
                        (actionId ? actionsMap[actionId]?.name : "") ||
                        actionSet?.actionName ||
                        actionSet?.set_name ||
                        "",
                    ).trim();
                })
                .filter((name: string) => !!name),
        ),
    );

    try {
        const { data: profile } = await supabase
            .from("user_profiles")
            .select("weight")
            .eq("user_id", userId)
            .maybeSingle();
        bodyWeight = Number(profile?.weight || 0);
    } catch {
        bodyWeight = 0;
    }

    try {
        const records = await getCurrent1RMRecords(userId, {
            actionIds: actionIds.length > 0 ? actionIds : undefined,
            actionNames: actionNames.length > 0 ? actionNames : undefined,
            // 与网站/小程序训练算重口径保持一致：优先动作库配置，再用历史峰值兜底。
            preferPR: true,
        });

        for (const record of records || []) {
            const current1RM = Number(record?.current1RM || 0);
            if (!Number.isFinite(current1RM) || current1RM <= 0) continue;

            if (record.actionId) {
                oneRMMap[record.actionId] = Math.max(
                    oneRMMap[record.actionId] || 0,
                    current1RM,
                );
            }
            if (record.actionName) {
                oneRMMap[record.actionName] = Math.max(
                    oneRMMap[record.actionName] || 0,
                    current1RM,
                );
            }
            if (record.canonicalActionId) {
                oneRMMap[record.canonicalActionId] = Math.max(
                    oneRMMap[record.canonicalActionId] || 0,
                    current1RM,
                );
            }
        }
    } catch {
        // best-effort
    }

    return {
        masterActionSets,
        actionsMap,
        bodyWeight,
        oneRMMap,
    };
}

export async function syncExecutionPlanWithCurrentConfig(
    execution: ExecutionRecord,
) {
    const existingActionExecutions = Array.isArray(execution?.action_executions)
        ? execution.action_executions
        : [];

    if (!execution?.instance_id || existingActionExecutions.length === 0) {
        return {
            execution,
            changed: false,
        };
    }

    const context = await loadPlanningContext({
        instanceId: execution.instance_id,
        dayIndex: execution.day_index,
        userId: execution.student_id,
    });

    if (!context) {
        return {
            execution,
            changed: false,
        };
    }

    let changed = false;

    const updatedActionExecutions = existingActionExecutions.map(
        (actionExec: any, actionIndex: number) => {
            if (actionExec?.source === "student_extra") {
                return actionExec;
            }

            const masterIndex = Number.isInteger(actionExec?.source_action_index)
                ? actionExec.source_action_index
                : actionIndex;
            const masterActionSet = context.masterActionSets[masterIndex];

            if (!masterActionSet) {
                return actionExec;
            }

            const planFields = resolveMasterPlanFields(masterActionSet, context);
            const existingSets = Array.isArray(actionExec?.sets)
                ? actionExec.sets
                : [];

            const updatedSets = existingSets.map((set: any) => {
                if (set?.source === "student_extra") {
                    return set;
                }

                const nextSet = {
                    ...set,
                    planned_weight: planFields.plannedWeight,
                    planned_reps: planFields.plannedReps,
                    planned_rest_seconds: planFields.plannedRestSeconds,
                };

                if (
                    set?.planned_weight !== nextSet.planned_weight ||
                    set?.planned_reps !== nextSet.planned_reps ||
                    set?.planned_rest_seconds !== nextSet.planned_rest_seconds
                ) {
                    changed = true;
                }

                return nextSet;
            });

            const completedSets = updatedSets.filter(
                (set: any) => set?.status === "completed",
            ).length;
            const totalSets = updatedSets.length;

            if (
                actionExec?.action_id !== planFields.actionId ||
                actionExec?.action_name !== planFields.actionName ||
                String(actionExec?.item_type || "").toUpperCase() !==
                    planFields.itemType ||
                actionExec?.source_action_index !== masterIndex ||
                actionExec?.completed_sets !== completedSets ||
                actionExec?.total_sets !== totalSets
            ) {
                changed = true;
            }

            return {
                ...actionExec,
                action_id: planFields.actionId,
                action_name: planFields.actionName,
                item_type: planFields.itemType,
                source_action_index: masterIndex,
                sets: updatedSets,
                completed_sets: completedSets,
                total_sets: totalSets,
            };
        },
    );

    const progress = computeExecutionProgress(updatedActionExecutions);
    if (
        execution.total_sets !== progress.totalItems ||
        execution.completed_sets !== progress.completedItems
    ) {
        changed = true;
    }

    if (!changed) {
        return {
            execution,
            changed: false,
        };
    }

    const nextExecution = {
        ...execution,
        action_executions: updatedActionExecutions,
        total_sets: progress.totalItems,
        completed_sets: progress.completedItems,
    };

    const { data: persistedExecution, error } = await supabase
        .from("plan_instance_executions")
        .update({
            action_executions: updatedActionExecutions,
            total_sets: progress.totalItems,
            completed_sets: progress.completedItems,
            updated_at: new Date().toISOString(),
        })
        .eq("id", execution.id)
        .select()
        .single();

    if (error || !persistedExecution) {
        console.warn("[execution] Failed to persist synced action plan:", error);
        return {
            execution: nextExecution,
            changed: true,
        };
    }

    return {
        execution: persistedExecution as ExecutionRecord,
        changed: true,
    };
}
