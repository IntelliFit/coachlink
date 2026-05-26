import type { ExecutionLike, TrainingDayLike } from "./subscriptionCredits";
import { deriveSubscriptionEntitlementState } from "./subscriptionEntitlementModel";

export type SubscriptionAccessBlockReason =
  | "SUBSCRIPTION_EXPIRED"
  | "PLAN_OUT_OF_SCOPE";

export type SubscriptionAccessSource = {
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  subscribed_weeks?: number | null;
};

export type SubscriptionAccessDecision = {
  allowed: boolean;
  reason?: SubscriptionAccessBlockReason;
  maxAccessibleDayIndex: number | null;
};

function parseOptionalDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function getMaxAccessibleDayIndex(
  subscribedWeeks?: number | null,
): number | null {
  const weeks = Number(subscribedWeeks ?? 0);
  if (!Number.isFinite(weeks) || weeks <= 0) return null;
  return Math.floor(weeks) * 7;
}

export function isSubscriptionExpired(
  subscription: SubscriptionAccessSource,
  now: Date = new Date(),
): boolean {
  const normalizedStatus = String(subscription.status ?? "")
    .trim()
    .toLowerCase();

  if (normalizedStatus && normalizedStatus !== "active") {
    return true;
  }

  const endDate = parseOptionalDate(subscription.end_date);
  if (!endDate) return false;

  return endDate.getTime() <= now.getTime();
}

export function evaluateSubscriptionPlanAccess(params: {
  subscription: SubscriptionAccessSource;
  requestedDayIndex?: number | null;
  now?: Date;
  trainingDays?: TrainingDayLike[] | null;
  executions?: ExecutionLike[] | null;
  startExecutionDay?: number | null;
  effectiveSubscribedWeeks?: number | null;
}): SubscriptionAccessDecision {
  const effectiveSubscribedWeeks =
    typeof params.effectiveSubscribedWeeks !== "undefined"
      ? Number(params.effectiveSubscribedWeeks ?? 0)
      : Number(params.subscription.subscribed_weeks ?? 0);

  const hasTrainingDays = Array.isArray(params.trainingDays);
  const state = deriveSubscriptionEntitlementState({
    subscription: params.subscription,
    planInstance: hasTrainingDays
      ? {
          id: "access-check",
          status: "active",
          training_days: params.trainingDays || [],
          start_execution_day: params.startExecutionDay ?? 1,
        }
      : null,
    executions: params.executions || [],
    effectiveSubscribedWeeks,
    now: params.now,
  });

  if (state.relationStatus !== "active") {
    return {
      allowed: false,
      reason: "SUBSCRIPTION_EXPIRED",
      maxAccessibleDayIndex: state.maxAccessibleDayIndex,
    };
  }

  if (!Number.isFinite(effectiveSubscribedWeeks) || effectiveSubscribedWeeks <= 0) {
    return {
      allowed: false,
      reason: "SUBSCRIPTION_EXPIRED",
      maxAccessibleDayIndex: state.maxAccessibleDayIndex,
    };
  }

  const requestedDayIndex = Number(params.requestedDayIndex ?? 0);
  const hasRequestedDay = Number.isFinite(requestedDayIndex) &&
    requestedDayIndex > 0;
  const startExecutionDay = Math.max(
    1,
    Number(params.startExecutionDay ?? 1),
  );

  if (hasRequestedDay && requestedDayIndex < startExecutionDay) {
    return {
      allowed: false,
      reason: "PLAN_OUT_OF_SCOPE",
      maxAccessibleDayIndex: state.maxAccessibleDayIndex,
    };
  }

  if (
    hasRequestedDay &&
    state.maxAccessibleDayIndex !== null &&
    requestedDayIndex > state.maxAccessibleDayIndex
  ) {
    return {
      allowed: false,
      reason: "PLAN_OUT_OF_SCOPE",
      maxAccessibleDayIndex: state.maxAccessibleDayIndex,
    };
  }

  if (
    hasTrainingDays &&
    !state.canTrain &&
    state.entitlementStatus !== "no_plan" &&
    state.planProgressStatus !== "completed"
  ) {
    return {
      allowed: false,
      reason: "SUBSCRIPTION_EXPIRED",
      maxAccessibleDayIndex: state.maxAccessibleDayIndex,
    };
  }

  return {
    allowed: true,
    maxAccessibleDayIndex: state.maxAccessibleDayIndex,
  };
}

export function filterTrainingDaysByAccessWindow<T extends {
  dayIndex?: number;
  day_index?: number;
}>(trainingDays: T[] | null | undefined, maxAccessibleDayIndex: number | null) {
  if (!Array.isArray(trainingDays)) return [];
  if (maxAccessibleDayIndex === null) return [...trainingDays];

  return trainingDays.filter((day) => {
    const dayIndex = Number(day?.dayIndex ?? day?.day_index ?? 0);
    return Number.isFinite(dayIndex) && dayIndex > 0 &&
      dayIndex <= maxAccessibleDayIndex;
  });
}
