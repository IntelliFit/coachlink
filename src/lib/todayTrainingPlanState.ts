export type TodayTrainingCoachPlanAccessStatus =
    | "available"
    | "plan_completed"
    | "entitlement_blocked"
    | "no_plan_assigned"
    | "load_failed";

export type TodayTrainingCoachPlanState = {
    instance?: unknown | null;
    accessStatus?: TodayTrainingCoachPlanAccessStatus | null;
};

export function hasRunnableCoachPlan(
    state?: TodayTrainingCoachPlanState | null,
) {
    return !!state?.instance && state.accessStatus !== "plan_completed";
}

export function shouldShowCoachPlanCompletedState(
    state?: TodayTrainingCoachPlanState | null,
) {
    return state?.accessStatus === "plan_completed";
}

