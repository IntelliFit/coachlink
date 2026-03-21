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
}): SubscriptionAccessDecision {
    const now = params.now ?? new Date();
    const maxAccessibleDayIndex = getMaxAccessibleDayIndex(
        params.subscription.subscribed_weeks,
    );

    if (isSubscriptionExpired(params.subscription, now)) {
        return {
            allowed: false,
            reason: "SUBSCRIPTION_EXPIRED",
            maxAccessibleDayIndex,
        };
    }

    const requestedDayIndex = Number(params.requestedDayIndex ?? 0);
    const hasRequestedDay = Number.isFinite(requestedDayIndex) &&
        requestedDayIndex > 0;

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

