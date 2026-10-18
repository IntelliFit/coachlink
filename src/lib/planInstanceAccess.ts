import { getLockedThroughDayIndex } from "@coachlink/core/src/planEditLock";

type PlanInstanceOwnership = {
    coach_id?: string | null;
    student_id?: string | null;
    coach_subscription_id?: string | null;
    source?: string | null;
};

export type PlanInstanceAccess = {
    /** The coach who owns the plan (or the subscription it belongs to). */
    isCoachOwner: boolean;
    /** A student managing a plan they created for themselves. */
    isSelfPlanOwner: boolean;
};

/**
 * Coach plans are managed by their coach only; the enrolled student trains on
 * them but cannot rewrite, archive or reactivate them. Students keep full
 * control of plans they created for themselves.
 */
export async function resolvePlanInstanceAccess(params: {
    client: any;
    instance: PlanInstanceOwnership;
    userId: string;
}): Promise<PlanInstanceAccess> {
    const { instance, userId } = params;
    const isSelfPlanOwner = !instance.coach_subscription_id &&
        instance.student_id === userId &&
        (instance.source === "self" || !instance.coach_id);

    let isCoachOwner = false;
    if (instance.coach_id) {
        const { data: coach } = await params.client
            .from("coaches")
            .select("user_id")
            .eq("id", instance.coach_id)
            .maybeSingle();
        isCoachOwner = !!coach?.user_id && coach.user_id === userId;
    }

    return { isCoachOwner, isSelfPlanOwner };
}

/** Furthest plan day with a workout record; days up to it must keep their structure. */
export async function loadPlanEditLock(params: { client: any; instanceId: string }) {
    const { data, error } = await params.client
        .from("plan_instance_executions")
        .select("day_index, status")
        .eq("instance_id", params.instanceId);
    if (error) {
        return { lockedThroughDayIndex: 0, error };
    }
    return { lockedThroughDayIndex: getLockedThroughDayIndex(data || []), error: null };
}
