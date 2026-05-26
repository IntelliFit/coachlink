import {
  computeCreditsScope,
  computeUsedCredits,
  estimateRemainingDays,
  type ExecutionLike,
  type TrainingDayLike,
} from "./subscriptionCredits";
import {
  deriveConsumedSubscriptionEndDate,
  deriveProjectedSubscriptionEndDate,
} from "./subscriptionEstimatedEndDate";
import {
  getSubscriptionLifecycle,
  type SubscriptionLifecycleStatus,
} from "./subscriptionLifecycle";
import { summarizePlanCompletion } from "./planInstanceCompletion";

export type SubscriptionRelationStatus =
  | "active"
  | "paused"
  | "cancelled"
  | "inactive";

export type SubscriptionEntitlementStatus =
  | "not_started"
  | "available"
  | "grace"
  | "exhausted"
  | "cancelled"
  | "no_entitlement"
  | "no_plan";

export type SubscriptionPlanProgressStatus =
  | "no_plan"
  | "not_started"
  | "in_progress"
  | "completed";

export type SubscriptionEntitlementDecision = {
  relationStatus: SubscriptionRelationStatus;
  entitlementStatus: SubscriptionEntitlementStatus;
  planProgressStatus: SubscriptionPlanProgressStatus;
  lifecycleStatus: SubscriptionLifecycleStatus;
  canTrain: boolean;
  canViewHistory: boolean;
  canRenew: boolean;
  shouldAutoCancel: boolean;
  displayEndDate: string | null;
  purchasedWeeks: number;
  effectiveWeeks: number;
  maxAccessibleDayIndex: number | null;
  totalCredits: number;
  usedCredits: number;
  remainingCredits: number;
  completedTrainingDays: number;
  resolvedTrainingDays: number;
  totalTrainingDays: number;
  isPlanCompleted: boolean;
  isPlanLogicallyCompleted: boolean;
  graceDaysLeft: number;
  graceDeadlineAt: string | null;
};

type SubscriptionSource = {
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  subscribed_weeks?: number | null;
};

type PlanInstanceSource = {
  id?: string | null;
  status?: string | null;
  training_days?: TrainingDayLike[] | null;
  start_execution_day?: number | null;
};

function normalizeStatus(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function getRelationStatus(status?: string | null): SubscriptionRelationStatus {
  const normalized = normalizeStatus(status);
  if (normalized === "active") return "active";
  if (normalized === "paused") return "paused";
  if (normalized === "cancelled" || normalized === "expired") return "cancelled";
  return "inactive";
}

function getPlanProgressStatus(params: {
  hasPlan: boolean;
  normalizedPlanStatus: string;
  isLogicallyCompleted: boolean;
  resolvedTrainingDays: number;
}): SubscriptionPlanProgressStatus {
  if (!params.hasPlan) return "no_plan";
  if (
    params.normalizedPlanStatus === "completed" ||
    params.isLogicallyCompleted
  ) {
    return "completed";
  }
  if (params.resolvedTrainingDays > 0) return "in_progress";
  return "not_started";
}

function getMaxAccessibleDayIndex(weeks: number) {
  if (!Number.isFinite(weeks) || weeks <= 0) return null;
  return Math.floor(weeks) * 7;
}

export function deriveSubscriptionEntitlementState(params: {
  subscription: SubscriptionSource | null | undefined;
  planInstance?: PlanInstanceSource | null;
  executions?: ExecutionLike[] | null;
  effectiveSubscribedWeeks?: number | null;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const subscription = params.subscription || {};
  const planInstance = params.planInstance || null;
  const relationStatus = getRelationStatus(subscription.status);
  const purchasedWeeks = Math.max(0, Number(subscription.subscribed_weeks || 0));
  const effectiveWeeks = Math.max(
    0,
    Number(
      typeof params.effectiveSubscribedWeeks !== "undefined"
        ? params.effectiveSubscribedWeeks
        : purchasedWeeks,
    ),
  );
  const hasPlan = !!planInstance?.id || Array.isArray(planInstance?.training_days);
  const trainingDays = Array.isArray(planInstance?.training_days)
    ? planInstance.training_days
    : [];
  const executions = Array.isArray(params.executions) ? params.executions : [];
  const startExecutionDay = Math.max(
    1,
    Number(planInstance?.start_execution_day || 1),
  );

  const completion = summarizePlanCompletion({
    trainingDays,
    startExecutionDay,
    executions: executions.map((execution: any) => ({
      day_index: Number(execution?.day_index || 0),
      status: execution?.status || null,
      completed_at: execution?.completed_at || null,
      updated_at: execution?.updated_at || null,
    })),
  });

  const normalizedPlanStatus = normalizeStatus(planInstance?.status);
  const planProgressStatus = getPlanProgressStatus({
    hasPlan,
    normalizedPlanStatus,
    isLogicallyCompleted: completion.isLogicallyCompleted,
    resolvedTrainingDays: completion.resolvedTrainingDays,
  });

  const scope = hasPlan
    ? computeCreditsScope({
      trainingDays,
      startExecutionDay,
      subscribedWeeks: effectiveWeeks,
    })
    : {
      scopeStartDayIndex: 1,
      scopeEndDayIndex: 0,
      eligibleTrainingDayIndexSet: new Set<number>(),
      totalCredits: 0,
    };

  const usedCredits = hasPlan
    ? computeUsedCredits({
      eligibleTrainingDayIndexSet: scope.eligibleTrainingDayIndexSet,
      executions,
      startExecutionDay,
    })
    : 0;
  const totalCredits = scope.totalCredits;
  const remainingCredits = Math.max(0, totalCredits - usedCredits);
  const maxAccessibleDayIndex = getMaxAccessibleDayIndex(effectiveWeeks);

  let displayEndDate: string | null = null;
  if (relationStatus === "active" && hasPlan && purchasedWeeks > 0) {
    displayEndDate = deriveProjectedSubscriptionEndDate({
      startDate: subscription.start_date || null,
      subscribedWeeks: purchasedWeeks,
      effectiveSubscribedWeeks: effectiveWeeks,
      trainingDays,
      startExecutionDay,
      executions,
      existingEndDate: subscription.end_date || null,
      now,
    });
  }
  if (!displayEndDate && remainingCredits <= 0 && totalCredits > 0) {
    displayEndDate = deriveConsumedSubscriptionEndDate({
      existingEndDate: subscription.end_date || null,
      executions,
      now,
    });
  }
  if (!displayEndDate) {
    displayEndDate = subscription.end_date || null;
  }

  const lifecycle = getSubscriptionLifecycle({
    subscription: {
      status: relationStatus === "active" ? "active" : relationStatus,
      end_date:
        relationStatus === "active" && totalCredits > 0 && remainingCredits > 0
          ? null
          : displayEndDate,
    },
    now,
  });

  let entitlementStatus: SubscriptionEntitlementStatus;
  if (relationStatus !== "active") {
    entitlementStatus = "cancelled";
  } else if (purchasedWeeks <= 0 || effectiveWeeks <= 0) {
    entitlementStatus = "no_entitlement";
  } else if (!hasPlan) {
    entitlementStatus = "no_plan";
  } else if (totalCredits <= 0) {
    entitlementStatus = "no_entitlement";
  } else if (remainingCredits > 0) {
    entitlementStatus = subscription.start_date ? "available" : "not_started";
  } else if (lifecycle.lifecycleStatus === "expired_grace") {
    entitlementStatus = "grace";
  } else {
    entitlementStatus = "exhausted";
  }

  const isPlanCompleted = planProgressStatus === "completed";
  const canTrain =
    relationStatus === "active" &&
    entitlementStatus !== "cancelled" &&
    entitlementStatus !== "exhausted" &&
    entitlementStatus !== "grace" &&
    entitlementStatus !== "no_entitlement" &&
    entitlementStatus !== "no_plan" &&
    hasPlan &&
    !isPlanCompleted;

  const shouldAutoCancel =
    relationStatus === "active" &&
    totalCredits > 0 &&
    remainingCredits <= 0 &&
    lifecycle.lifecycleStatus === "expired_cancelled";

  return {
    relationStatus,
    entitlementStatus,
    planProgressStatus,
    lifecycleStatus: lifecycle.lifecycleStatus,
    canTrain,
    canViewHistory: hasPlan,
    canRenew: relationStatus === "active",
    shouldAutoCancel,
    displayEndDate,
    purchasedWeeks,
    effectiveWeeks,
    maxAccessibleDayIndex,
    totalCredits,
    usedCredits,
    remainingCredits,
    completedTrainingDays: completion.completedTrainingDays,
    resolvedTrainingDays: completion.resolvedTrainingDays,
    totalTrainingDays: completion.totalTrainingDays,
    isPlanCompleted,
    isPlanLogicallyCompleted: completion.isLogicallyCompleted,
    graceDaysLeft: lifecycle.graceDaysLeft,
    graceDeadlineAt: lifecycle.graceDeadlineAt,
  } satisfies SubscriptionEntitlementDecision;
}

export function getEstimatedEndDateFromEntitlementState(
  state: Pick<SubscriptionEntitlementDecision, "displayEndDate">,
) {
  return state.displayEndDate;
}

export function estimateEndDateFromCredits(params: {
  totalCredits: number;
  remainingCredits: number;
  cadenceWeeks: number;
  now?: Date;
}) {
  const remainingDays = estimateRemainingDays({
    cadenceWeeks: Math.max(1, Number(params.cadenceWeeks || 1)),
    totalCredits: params.totalCredits,
    remainingCredits: params.remainingCredits,
    fallbackCreditsPerWeek: 3,
  });
  const end = params.now ? new Date(params.now) : new Date();
  end.setDate(end.getDate() + remainingDays);
  return end.toISOString();
}
