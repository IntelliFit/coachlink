export const SUBSCRIPTION_GRACE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SubscriptionLifecycleStatus =
    | "active"
    | "expired_grace"
    | "expired_cancelled";

type LifecycleSource = {
    status?: string | null;
    end_date?: string | null;
};

function parseDateOrNull(value?: string | null): Date | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

export function getSubscriptionLifecycle(params: {
    subscription: LifecycleSource;
    now?: Date;
    graceDays?: number;
}) {
    const now = params.now ?? new Date();
    const graceDays = Math.max(0, Number(params.graceDays ?? SUBSCRIPTION_GRACE_DAYS));
    const graceMs = graceDays * DAY_MS;

    const normalizedStatus = String(params.subscription.status ?? "")
        .trim()
        .toLowerCase();

    if (normalizedStatus && normalizedStatus !== "active") {
        return {
            lifecycleStatus: "expired_cancelled" as SubscriptionLifecycleStatus,
            isExpired: true,
            isInGracePeriod: false,
            overdueMs: 0,
            overdueDays: 0,
            graceDaysLeft: 0,
            graceDeadlineAt: null as string | null,
        };
    }

    const endDate = parseDateOrNull(params.subscription.end_date);
    if (!endDate) {
        return {
            lifecycleStatus: "active" as SubscriptionLifecycleStatus,
            isExpired: false,
            isInGracePeriod: false,
            overdueMs: 0,
            overdueDays: 0,
            graceDaysLeft: graceDays,
            graceDeadlineAt: null as string | null,
        };
    }

    const overdueMs = now.getTime() - endDate.getTime();
    if (overdueMs <= 0) {
        return {
            lifecycleStatus: "active" as SubscriptionLifecycleStatus,
            isExpired: false,
            isInGracePeriod: false,
            overdueMs: 0,
            overdueDays: 0,
            graceDaysLeft: graceDays,
            graceDeadlineAt: new Date(endDate.getTime() + graceMs).toISOString(),
        };
    }

    const overdueDays = Math.max(0, Math.floor(overdueMs / DAY_MS));
    const graceDeadlineAt = new Date(endDate.getTime() + graceMs);

    if (overdueMs > graceMs) {
        return {
            lifecycleStatus: "expired_cancelled" as SubscriptionLifecycleStatus,
            isExpired: true,
            isInGracePeriod: false,
            overdueMs,
            overdueDays,
            graceDaysLeft: 0,
            graceDeadlineAt: graceDeadlineAt.toISOString(),
        };
    }

    const graceDaysLeft = Math.max(0, Math.ceil((graceMs - overdueMs) / DAY_MS));
    return {
        lifecycleStatus: "expired_grace" as SubscriptionLifecycleStatus,
        isExpired: true,
        isInGracePeriod: true,
        overdueMs,
        overdueDays,
        graceDaysLeft,
        graceDeadlineAt: graceDeadlineAt.toISOString(),
    };
}

