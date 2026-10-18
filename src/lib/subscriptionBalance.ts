import { deriveSubscriptionCarryoverSummaryFromHistory } from "@/lib/subscriptionCarryover";
import { deriveSubscriptionEntitlementState } from "@/lib/subscriptionEntitlementModel";

type BalanceInstance = {
    id?: string | null;
    status?: string | null;
    created_at?: string | null;
    training_days?: any[] | null;
    start_execution_day?: number | null;
    entitlement_consumption_policy?: string | null;
};

type BalanceExecution = {
    instance_id?: string | null;
    day_index?: number | null;
    status?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
};

type BalanceSubscription = {
    status?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    subscribed_weeks?: number | null;
};

const CURRENT_PLAN_RANK: Record<string, number> = { active: 3, paused: 3, scheduled: 2, completed: 1 };

// Rows without a status (legacy data, tests) are eligible but rank last, the
// same leniency the carryover history applies.
function planRank(status?: string | null) {
    const normalized = String(status || "").trim().toLowerCase();
    return normalized ? CURRENT_PLAN_RANK[normalized] ?? 0 : 0.5;
}

/**
 * The plan a subscription's balance is measured against: the newest running
 * (active/paused) plan, else the newest scheduled one, else the newest completed
 * one. Archived plans only ever count as history.
 */
export function pickCurrentPlanInstance<T extends BalanceInstance>(instances: T[] | null | undefined): T | null {
    const candidates = (instances || []).filter((instance) => {
        return !!instance?.id && planRank(instance.status) > 0 &&
            Array.isArray(instance.training_days) && instance.training_days.length > 0;
    });
    candidates.sort((left, right) => {
        const byRank = planRank(right.status) - planRank(left.status);
        return byRank || String(right.created_at || "").localeCompare(String(left.created_at || ""));
    });
    return candidates[0] || null;
}

/**
 * The single balance rule shared by every page and job: earlier plan versions
 * (created before the current plan) are summed as carryover, then the current
 * plan's own completed sessions are charged against what is left. This is the
 * same composition the student-facing training gate uses.
 */
export function deriveSubscriptionBalance(params: {
    subscription: BalanceSubscription;
    instances: BalanceInstance[];
    executions: BalanceExecution[];
    currentInstance?: BalanceInstance | null;
    now?: Date;
}) {
    const currentInstance = params.currentInstance ?? pickCurrentPlanInstance(params.instances);
    if (!currentInstance?.id) return null;

    const carryover = deriveSubscriptionCarryoverSummaryFromHistory({
        subscribedWeeks: Number(params.subscription.subscribed_weeks || 0),
        instances: params.instances,
        executions: params.executions,
        excludeInstanceId: String(currentInstance.id),
        createdBefore: currentInstance.created_at || null,
        subscriptionStartDate: params.subscription.start_date || null,
    });
    const state = deriveSubscriptionEntitlementState({
        subscription: params.subscription,
        planInstance: currentInstance,
        executions: params.executions
            .filter((execution) => execution.instance_id === currentInstance.id)
            .map((execution) => ({
                day_index: Number(execution.day_index || 0),
                status: execution.status || null,
                completed_at: execution.completed_at || null,
                updated_at: execution.updated_at || null,
                started_at: execution.started_at || null,
                created_at: execution.created_at || null,
            })),
        effectiveSubscribedWeeks: carryover.remainingWeeks,
        now: params.now,
    });
    return { currentInstance, carryover, state };
}

/** Loads one subscription's plans and completed sessions and applies the shared balance rule. */
export async function loadSubscriptionBalance(subscriptionId: string, now?: Date) {
    const { serviceRoleSupabase } = await import("@/lib/supabaseClient");
    const { readAllRowsByIdChunks } = await import("@/lib/supabaseKeysetPages");
    const db = serviceRoleSupabase as any;
    const { data: subscription, error: subscriptionError } = await db
        .from("coach_subscriptions")
        .select("id, status, start_date, end_date, subscribed_weeks")
        .eq("id", subscriptionId)
        .maybeSingle();
    if (subscriptionError) throw new Error(`读取订阅失败: ${subscriptionError.message}`);
    if (!subscription) return null;

    const { data: instances, error: instancesError } = await db
        .from("coach_plan_instances")
        .select("id, status, created_at, training_days, start_execution_day, entitlement_consumption_policy")
        .eq("coach_subscription_id", subscriptionId);
    if (instancesError) throw new Error(`读取订阅计划失败: ${instancesError.message}`);

    const instanceIds = (instances || []).map((instance: any) => String(instance.id));
    const { data: executions, error: executionsError } = await readAllRowsByIdChunks<any>(instanceIds, (chunk, afterId) => {
        let query = db
            .from("plan_instance_executions")
            .select("id, instance_id, day_index, status, started_at, completed_at, created_at, updated_at")
            .in("instance_id", chunk)
            .eq("status", "completed");
        if (afterId) query = query.gt("id", afterId);
        return query.order("id", { ascending: true });
    });
    if (executionsError) throw new Error(`读取订阅训练失败: ${(executionsError as any)?.message || executionsError}`);

    const balance = deriveSubscriptionBalance({ subscription, instances: instances || [], executions: executions || [], now });
    return balance ? { subscription, ...balance } : { subscription, currentInstance: null, carryover: null, state: null };
}
