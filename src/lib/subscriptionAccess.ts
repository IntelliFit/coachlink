import {
    computeCreditsScope,
    computeUsedCredits,
    type ExecutionLike,
    type TrainingDayLike,
} from "./subscriptionCredits";

export type SubscriptionAccessBlockReason =
    | "SUBSCRIPTION_EXPIRED"
    | "PLAN_OUT_OF_SCOPE";

export type SubscriptionAccessSource = {
    status?: string | null;
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
    const normalizedStatus = String(params.subscription.status ?? "")
        .trim()
        .toLowerCase();
    const effectiveSubscribedWeeks = typeof params.effectiveSubscribedWeeks !==
            "undefined"
        ? Number(params.effectiveSubscribedWeeks ?? 0)
        : Number(params.subscription.subscribed_weeks ?? 0);
    const maxAccessibleDayIndex = getMaxAccessibleDayIndex(
        effectiveSubscribedWeeks,
    );

    // 访问门禁以 credits 为准：active 订阅不再被 end_date 直接拦截。
    // 非 active（cancelled/expired/paused 等）仍直接视为不可继续训练。
    if (normalizedStatus && normalizedStatus !== "active") {
        return {
            allowed: false,
            reason: "SUBSCRIPTION_EXPIRED",
            maxAccessibleDayIndex,
        };
    }

    if (!Number.isFinite(effectiveSubscribedWeeks) || effectiveSubscribedWeeks <= 0) {
        return {
            allowed: false,
            reason: "SUBSCRIPTION_EXPIRED",
            maxAccessibleDayIndex,
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
            maxAccessibleDayIndex,
        };
    }

    if (
        hasRequestedDay &&
        maxAccessibleDayIndex !== null &&
        requestedDayIndex > maxAccessibleDayIndex
    ) {
        return {
            allowed: false,
            reason: "PLAN_OUT_OF_SCOPE",
            maxAccessibleDayIndex,
        };
    }

    const trainingDays = Array.isArray(params.trainingDays)
        ? params.trainingDays
        : null;
    if (trainingDays) {
        const scope = computeCreditsScope({
            trainingDays,
            startExecutionDay,
            subscribedWeeks: effectiveSubscribedWeeks,
        });

        if (scope.totalCredits > 0) {
            const usedCredits = computeUsedCredits({
                eligibleTrainingDayIndexSet: scope.eligibleTrainingDayIndexSet,
                executions: Array.isArray(params.executions) ? params.executions : [],
                startExecutionDay,
            });
            if (usedCredits >= scope.totalCredits) {
                return {
                    allowed: false,
                    reason: "SUBSCRIPTION_EXPIRED",
                    maxAccessibleDayIndex,
                };
            }
        }
    }

    return {
        allowed: true,
        maxAccessibleDayIndex,
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

