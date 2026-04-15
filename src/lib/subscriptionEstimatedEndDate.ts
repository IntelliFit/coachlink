import {
  computeCreditsScope,
  computeUsedCredits,
  estimateRemainingDays,
  type ExecutionLike,
  type TrainingDayLike,
} from "./subscriptionCredits";

function parseOptionalDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function deriveProjectedSubscriptionEndDate(params: {
  startDate?: string | null;
  subscribedWeeks?: number | null;
  effectiveSubscribedWeeks?: number | null;
  trainingDays?: TrainingDayLike[] | null;
  startExecutionDay?: number | null;
  executions?: ExecutionLike[] | null;
  now?: Date;
}): string | null {
  const startDate = parseOptionalDate(params.startDate);
  if (!startDate) return null;

  const subscribedWeeks = typeof params.effectiveSubscribedWeeks !== "undefined"
    ? Number(params.effectiveSubscribedWeeks ?? 0)
    : Number(params.subscribedWeeks || 0);
  if (!Number.isFinite(subscribedWeeks) || subscribedWeeks <= 0) return null;

  const trainingDays = Array.isArray(params.trainingDays) ? params.trainingDays : [];
  if (trainingDays.length === 0) return null;

  const scope = computeCreditsScope({
    trainingDays,
    startExecutionDay: Number(params.startExecutionDay || 1),
    subscribedWeeks,
  });

  if (scope.totalCredits <= 0) return null;

  const usedCredits = computeUsedCredits({
    eligibleTrainingDayIndexSet: scope.eligibleTrainingDayIndexSet,
    executions: Array.isArray(params.executions) ? params.executions : [],
    startExecutionDay: Number(params.startExecutionDay || 1),
  });

  const remainingCredits = Math.max(0, scope.totalCredits - usedCredits);
  const projectedEndDate = params.now ? new Date(params.now) : new Date();
  const effectivePlanWeeks = Math.max(
    1,
    Math.ceil((scope.scopeEndDayIndex - scope.scopeStartDayIndex + 1) / 7),
  );

  if (remainingCredits === 0) {
    return projectedEndDate.toISOString();
  }

  const remainingDaysEstimate = estimateRemainingDays({
    cadenceWeeks: effectivePlanWeeks,
    totalCredits: scope.totalCredits,
    remainingCredits,
    fallbackCreditsPerWeek: 3,
  });

  projectedEndDate.setDate(projectedEndDate.getDate() + remainingDaysEstimate);
  return projectedEndDate.toISOString();
}
