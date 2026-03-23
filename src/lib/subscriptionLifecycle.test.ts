import { describe, expect, it } from "vitest";
import { getSubscriptionLifecycle, SUBSCRIPTION_GRACE_DAYS } from "./subscriptionLifecycle";

describe("subscriptionLifecycle", () => {
  it("keeps active subscription as active before end_date", () => {
    const now = new Date("2026-03-21T12:00:00.000Z");
    const lifecycle = getSubscriptionLifecycle({
      subscription: {
        status: "active",
        end_date: "2026-03-25T00:00:00.000Z",
      },
      now,
    });

    expect(lifecycle.lifecycleStatus).toBe("active");
    expect(lifecycle.isInGracePeriod).toBe(false);
  });

  it("marks subscription as expired_grace within 14 days after end_date", () => {
    const now = new Date("2026-03-21T12:00:00.000Z");
    const lifecycle = getSubscriptionLifecycle({
      subscription: {
        status: "active",
        end_date: "2026-03-15T12:00:00.000Z",
      },
      now,
    });

    expect(lifecycle.lifecycleStatus).toBe("expired_grace");
    expect(lifecycle.isInGracePeriod).toBe(true);
    expect(lifecycle.graceDaysLeft).toBeGreaterThan(0);
  });

  it("marks subscription as expired_cancelled after grace deadline", () => {
    const endDate = new Date("2026-03-01T00:00:00.000Z");
    const now = new Date(endDate.getTime() + (SUBSCRIPTION_GRACE_DAYS + 1) * 24 * 60 * 60 * 1000);
    const lifecycle = getSubscriptionLifecycle({
      subscription: {
        status: "active",
        end_date: endDate.toISOString(),
      },
      now,
    });

    expect(lifecycle.lifecycleStatus).toBe("expired_cancelled");
    expect(lifecycle.isInGracePeriod).toBe(false);
    expect(lifecycle.graceDaysLeft).toBe(0);
  });

  it("treats non-active status as cancelled lifecycle", () => {
    const lifecycle = getSubscriptionLifecycle({
      subscription: {
        status: "cancelled",
        end_date: "2026-03-30T00:00:00.000Z",
      },
      now: new Date("2026-03-21T12:00:00.000Z"),
    });

    expect(lifecycle.lifecycleStatus).toBe("expired_cancelled");
  });
});
