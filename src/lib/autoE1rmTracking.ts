import supabase from "@/lib/supabaseClient";
import {
    calculateE1RM,
    isNewPR,
    PR_THRESHOLD_KG,
    requiresBodyWeightFallback,
} from "@/lib/e1rmCalculator";
import { isOneRMEligibleAction } from "@/lib/oneRmEligibility";

type ActionConfig = {
    name?: string;
    includesBodyWeight?: boolean;
};

export type AutoE1RMCheckResult = {
    isPR: boolean;
    e1rm: number;
    previousPR?: number;
};

type AutoE1RMCheckParams = {
    userId: string;
    actionId?: string | null;
    actionName: string;
    weight: number;
    reps: number;
    executionId?: string | null;
    setNumber: number;
    isCoachSubscriptionPlan?: boolean;
    sourceType?: string | null;
};

async function resolveActionConfig(params: {
    userId: string;
    actionId?: string | null;
    actionName: string;
}): Promise<ActionConfig> {
    const { userId, actionId, actionName } = params;
    const trimmedActionId = String(actionId || "").trim();
    const trimmedActionName = String(actionName || "").trim();

    if (trimmedActionId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: coachAction } = await (supabase as any)
            .from("coach_actions")
            .select('name, "includesBodyWeight"')
            .eq("id", trimmedActionId)
            .maybeSingle();
        if (coachAction) {
            return {
                name: coachAction.name || trimmedActionName,
                includesBodyWeight: coachAction.includesBodyWeight,
            };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: studentAction } = await (supabase as any)
            .from("student_actions")
            .select('name, "includesBodyWeight"')
            .eq("id", trimmedActionId)
            .eq("user_id", userId)
            .maybeSingle();
        if (studentAction) {
            return {
                name: studentAction.name || trimmedActionName,
                includesBodyWeight: studentAction.includesBodyWeight,
            };
        }
    }

    if (trimmedActionName) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: coachActionByName } = await (supabase as any)
            .from("coach_actions")
            .select('name, "includesBodyWeight"')
            .eq("name", trimmedActionName)
            .limit(1)
            .maybeSingle();
        if (coachActionByName) {
            return {
                name: coachActionByName.name || trimmedActionName,
                includesBodyWeight: coachActionByName.includesBodyWeight,
            };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: studentActionByName } = await (supabase as any)
            .from("student_actions")
            .select('name, "includesBodyWeight"')
            .eq("name", trimmedActionName)
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();
        if (studentActionByName) {
            return {
                name: studentActionByName.name || trimmedActionName,
                includesBodyWeight: studentActionByName.includesBodyWeight,
            };
        }
    }

    return {
        name: trimmedActionName,
        includesBodyWeight: undefined,
    };
}

async function bumpStudentActionReference1RM(params: {
    userId: string;
    actionId?: string | null;
    actionName: string;
    e1rm: number;
}) {
    const { userId, actionId, actionName, e1rm } = params;
    if (!Number.isFinite(e1rm) || e1rm <= 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let targetAction: any = null;
    const trimmedActionId = String(actionId || "").trim();

    if (trimmedActionId) {
        // 1) 最优先：如果 actionId 本身就是学员动作 ID，直接命中。
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: byId } = await (supabase as any)
            .from("student_actions")
            .select('id, name, canonical_action_id, type, attrs, "enableAutoWeightCompute", reference_1rm')
            .eq("user_id", userId)
            .eq("id", trimmedActionId)
            .maybeSingle();
        if (byId) {
            targetAction = byId;
        }
    }

    // 2) 若没命中，尝试走教练动作 canonical -> 学员动作 canonical 的映射。
    if (!targetAction && trimmedActionId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: coachAction } = await (supabase as any)
            .from("coach_actions")
            .select("canonical_action_id, name")
            .eq("id", trimmedActionId)
            .maybeSingle();

        if (coachAction?.canonical_action_id) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: byCanonical } = await (supabase as any)
                .from("student_actions")
                .select('id, name, canonical_action_id, type, attrs, "enableAutoWeightCompute", reference_1rm')
                .eq("user_id", userId)
                .eq("canonical_action_id", coachAction.canonical_action_id)
                .limit(1)
                .maybeSingle();
            if (byCanonical) {
                targetAction = byCanonical;
            }
        }

        if (!targetAction) {
            const nameForMatch = coachAction?.name || actionName;
            if (nameForMatch) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: byName } = await (supabase as any)
                    .from("student_actions")
                    .select('id, name, canonical_action_id, type, attrs, "enableAutoWeightCompute", reference_1rm')
                    .eq("user_id", userId)
                    .eq("name", nameForMatch)
                    .limit(1)
                    .maybeSingle();
                if (byName) {
                    targetAction = byName;
                }
            }
        }
    }

    if (!targetAction && actionName) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: byName } = await (supabase as any)
            .from("student_actions")
            .select('id, name, canonical_action_id, type, attrs, "enableAutoWeightCompute", reference_1rm')
            .eq("user_id", userId)
            .eq("name", actionName)
            .limit(1)
            .maybeSingle();
        if (byName) {
            targetAction = byName;
        }
    }

    if (!targetAction?.id) return;

    const eligible = isOneRMEligibleAction({
        type: targetAction.type,
        attrs: targetAction.attrs,
        enableAutoWeightCompute: targetAction.enableAutoWeightCompute,
    });
    if (!eligible) return;

    const current = Number(targetAction.reference_1rm);
    const shouldIncrease = !Number.isFinite(current) || current <= 0 ||
        (e1rm - current) > PR_THRESHOLD_KG;
    if (!shouldIncrease) return;

    await supabase
        .from("student_actions")
        .update({
            reference_1rm: e1rm,
            updated_at: new Date().toISOString(),
        })
        .eq("id", targetAction.id)
        .eq("user_id", userId);
}

function applyActionFilter(query: any, params: {
    actionId?: string | null;
    actionName: string;
}) {
    const trimmedActionId = String(params.actionId || "").trim();
    if (trimmedActionId) {
        return query.eq("action_id", trimmedActionId);
    }
    return query.eq("exercise_name", params.actionName);
}

export async function handleAutoE1RMCheck(
    params: AutoE1RMCheckParams,
): Promise<AutoE1RMCheckResult | null> {
    const {
        userId,
        actionId,
        actionName,
        weight,
        reps,
        executionId,
        setNumber,
        isCoachSubscriptionPlan = false,
        sourceType = null,
    } = params;

    if (
        weight === null || weight === undefined || !Number.isFinite(weight) ||
        !reps || reps <= 0
    ) {
        return null;
    }

    const actionConfig = await resolveActionConfig({ userId, actionId, actionName });
    const effectiveActionName = String(actionConfig.name || actionName || "").trim() || "未知动作";
    const includeBodyWeight = actionConfig.includesBodyWeight !== undefined
        ? actionConfig.includesBodyWeight
        : requiresBodyWeightFallback(effectiveActionName);

    let bodyWeight = 0;
    if (includeBodyWeight) {
        const { data: profile } = await supabase
            .from("user_profiles")
            .select("weight")
            .eq("user_id", userId)
            .single();
        bodyWeight = profile?.weight || 0;
    }

    if (!includeBodyWeight) {
        if (weight <= 0) return null;
    } else {
        if (!bodyWeight || bodyWeight <= 0) return null;
        if (weight + bodyWeight <= 0) return null;
    }

    const result = calculateE1RM({
        weight,
        reps,
        bodyWeight,
        includeBodyWeight,
    });
    const { e1rm, epley, brzycki, lombardi } = result;

    try {
        await bumpStudentActionReference1RM({
            userId,
            actionId,
            actionName: effectiveActionName,
            e1rm,
        });
    } catch (error) {
        console.warn("[e1RM] Failed to bump student_actions.reference_1rm:", error);
    }

    try {
        const today = new Date().toISOString().split("T")[0];
        const autoStateQuery = applyActionFilter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from("personal_records_history")
                .select("id, e1rm, date_achieved, created_at")
                .eq("user_id", userId)
                .eq("notes", "AUTO_STATE"),
            { actionId, actionName: effectiveActionName },
        )
            .order("date_achieved", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(1);
        const { data: latestState } = await autoStateQuery.maybeSingle();

        const prev = latestState?.e1rm;
        const shouldUpdate = prev === undefined || prev === null
            ? true
            : isCoachSubscriptionPlan
                ? (Number(e1rm) - Number(prev)) > PR_THRESHOLD_KG
                : Math.abs(Number(e1rm) - Number(prev)) >= PR_THRESHOLD_KG;

        if (shouldUpdate) {
            const todayStateQuery = applyActionFilter(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (supabase as any)
                    .from("personal_records_history")
                    .select("id, e1rm")
                    .eq("user_id", userId)
                    .eq("notes", "AUTO_STATE")
                    .eq("date_achieved", today),
                { actionId, actionName: effectiveActionName },
            );
            const { data: todayState } = await todayStateQuery.maybeSingle();

            const estimatedFrom = {
                weight,
                reps,
                bodyWeight: includeBodyWeight ? bodyWeight : undefined,
                epley,
                brzycki,
                lombardi,
            };
            const executionIdForRecord = sourceType === "impromptu_execution"
                ? null
                : (executionId || null);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const q: any = (supabase as any).from("personal_records_history");
            if (todayState?.id) {
                await q
                    .update({
                        weight,
                        reps,
                        e1rm,
                        estimated_from: estimatedFrom,
                        execution_id: executionIdForRecord,
                        execution_set_number: setNumber,
                        load_formula:
                            `${weight}kg × ${reps}次 = e1RM ${e1rm}kg`,
                        source_type: sourceType || null,
                    })
                    .eq("id", todayState.id);
            } else {
                await q.insert({
                    user_id: userId,
                    action_id: actionId || null,
                    exercise_name: effectiveActionName,
                    weight,
                    reps,
                    e1rm,
                    load_formula: `${weight}kg × ${reps}次 = e1RM ${e1rm}kg`,
                    execution_id: executionIdForRecord,
                    execution_set_number: setNumber,
                    date_achieved: today,
                    is_auto_calculated: true,
                    estimated_from: estimatedFrom,
                    notes: "AUTO_STATE",
                    is_verified: false,
                    source_type: sourceType || null,
                });
            }
        }
    } catch (error) {
        console.warn("[e1RM] Failed to update AUTO_STATE:", error);
    }

    const currentPRQuery = applyActionFilter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
            .from("personal_records_history")
            .select("id, e1rm")
            .eq("user_id", userId),
        { actionId, actionName: effectiveActionName },
    )
        .order("e1rm", { ascending: false })
        .limit(1);
    const { data: currentPR } = await currentPRQuery.maybeSingle();

    if (!isNewPR(e1rm, currentPR?.e1rm)) {
        return { isPR: false, e1rm };
    }

    const today = new Date().toISOString().split("T")[0];
    const todayPRQuery = applyActionFilter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
            .from("personal_records_history")
            .select("id, e1rm")
            .eq("user_id", userId)
            .eq("date_achieved", today)
            .eq("is_auto_calculated", true),
        { actionId, actionName: effectiveActionName },
    );
    const { data: todayPR } = await todayPRQuery.maybeSingle();

    const estimatedFrom = {
        weight,
        reps,
        bodyWeight: includeBodyWeight ? bodyWeight : undefined,
        epley,
        brzycki,
        lombardi,
    };
    const executionIdForRecord = sourceType === "impromptu_execution"
        ? null
        : (executionId || null);

    if (todayPR) {
        if (e1rm > todayPR.e1rm) {
            const { error } = await supabase
                .from("personal_records_history")
                .update({
                    action_id: actionId || null,
                    exercise_name: effectiveActionName,
                    weight,
                    reps,
                    e1rm,
                    estimated_from: estimatedFrom,
                    execution_id: executionIdForRecord,
                    execution_set_number: setNumber,
                    load_formula: `${weight}kg × ${reps}次 = e1RM ${e1rm}kg`,
                    source_type: sourceType || null,
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
        return { isPR: false, e1rm };
    }

    const { error } = await supabase.from("personal_records_history")
        .insert({
            user_id: userId,
            action_id: actionId || null,
            exercise_name: effectiveActionName,
            weight,
            reps,
            e1rm,
            load_formula: `${weight}kg × ${reps}次 = e1RM ${e1rm}kg`,
            execution_id: executionIdForRecord,
            execution_set_number: setNumber,
            date_achieved: today,
            is_auto_calculated: true,
            estimated_from: estimatedFrom,
            is_verified: false,
            source_type: sourceType || null,
        });

    if (error) {
        console.error("[e1RM] Failed to insert new PR:", error);
        return { isPR: false, e1rm };
    }

    console.log(
        `[e1RM] New PR created: ${effectiveActionName} = ${e1rm}kg (prev: ${
            currentPR?.e1rm || "none"
        })`,
    );
    return { isPR: true, e1rm, previousPR: currentPR?.e1rm };
}
