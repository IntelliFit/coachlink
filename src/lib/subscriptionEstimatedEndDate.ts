import {
  computeCreditsScope,
  computeUsedCredits,
  estimateRemainingDays,
  type ExecutionLike,
  type TrainingDayLike,
} from "./subscriptionCredits";
import { computeConsumedServiceWeeks, SERVICE_WEEK_EPSILON } from './subscriptionServiceWeeks';

function parseOptionalDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function pickLatestExecutionTimestamp(executions?: ExecutionLike[] | null): Date | null {
  let latest: Date | null = null;

  for (const execution of executions || []) {
    const resolvedAt = parseOptionalDate(
      (execution as any)?.completed_at ||
      (execution as any)?.updated_at ||
      (execution as any)?.started_at ||
      (execution as any)?.created_at ||
      null,
    );
    if (!resolvedAt) continue;

    if (!latest || resolvedAt.getTime() > latest.getTime()) {
      latest = resolvedAt;
    }
  }

  return latest;
}

export function deriveConsumedSubscriptionEndDate(params: {
  existingEndDate?: string | null;
  executions?: ExecutionLike[] | null;
  now?: Date;
}): string {
  const now = params.now ? new Date(params.now) : new Date();
  const latestExecutionAt = pickLatestExecutionTimestamp(params.executions);
  const existingEndDate = parseOptionalDate(params.existingEndDate);

  if (latestExecutionAt) {
    return latestExecutionAt.toISOString();
  }

  if (existingEndDate && existingEndDate.getTime() <= now.getTime()) {
    return existingEndDate.toISOString();
  }

  return now.toISOString();
}

export function deriveProjectedSubscriptionEndDate(params: {
  startDate?: string | null;
  subscribedWeeks?: number | null;
  effectiveSubscribedWeeks?: number | null;
  trainingDays?: TrainingDayLike[] | null;
  startExecutionDay?: number | null;
  executions?: ExecutionLike[] | null;
  existingEndDate?: string | null;
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
    return deriveConsumedSubscriptionEndDate({
      existingEndDate: params.existingEndDate,
      executions: params.executions,
      now: projectedEndDate,
    });
  }

  const remainingDaysEstimate = estimateRemainingDays({
    cadenceWeeks: effectivePlanWeeks,
    totalCredits: scope.totalCredits,
    remainingCredits,
    fallbackCreditsPerWeek: 3,
  });

  projectedEndDate.setDate(projectedEndDate.getDate() + remainingDaysEstimate);
  if (Math.abs(subscribedWeeks - Math.round(subscribedWeeks)) > SERVICE_WEEK_EPSILON) {
    const usedServiceWeeks = computeConsumedServiceWeeks({ trainingDays,
      executions: (params.executions || []).filter(e => scope.eligibleTrainingDayIndexSet.has(e.day_index)),
      startExecutionDay: params.startExecutionDay });
    const remainingServiceWeeks = Math.max(0, subscribedWeeks - usedServiceWeeks);
    const serviceEnd = params.now ? new Date(params.now) : new Date();
    serviceEnd.setDate(serviceEnd.getDate() + Math.ceil(remainingServiceWeeks * 7 - SERVICE_WEEK_EPSILON));
    return serviceEnd.toISOString();
  }
  return projectedEndDate.toISOString();
}
