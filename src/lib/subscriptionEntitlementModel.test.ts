import { describe, expect, it } from "vitest";
import { deriveSubscriptionEntitlementState } from "./subscriptionEntitlementModel";

function makePlan(weeks: number, trainingDaysPerWeek = 4) {
  const days: Array<{ dayIndex: number; type: string }> = [];
  for (let week = 0; week < weeks; week += 1) {
    for (let day = 1; day <= 7; day += 1) {
      const dayIndex = week * 7 + day;
      days.push({
        dayIndex,
        type: day <= trainingDaysPerWeek ? "training" : "rest",
      });
    }
  }
  return days;
}

describe("subscriptionEntitlementModel", () => {
  it("keeps an active started subscription trainable when credits remain even if raw end_date is stale", () => {
    const state = deriveSubscriptionEntitlementState({
      subscription: {
        status: "active",
        start_date: "2026-01-12T00:00:00.000Z",
        end_date: "2026-03-14T00:00:00.000Z",
        subscribed_weeks: 4,
      },
      planInstance: {
        id: "instance-1",
        status: "active",
        start_execution_day: 1,
        training_days: makePlan(15, 4),
      },
      executions: [
        { day_index: 1, status: "completed" },
        { day_index: 2, status: "completed" },
        { day_index: 3, status: "completed" },
        { day_index: 4, status: "completed" },
        { day_index: 8, status: "in_progress" },
      ],
      now: new Date("2026-05-27T00:00:00.000Z"),
    });

    expect(state.entitlementStatus).toBe("available");
    expect(state.canTrain).toBe(true);
    expect(state.remainingCredits).toBe(12);
    expect(state.planProgressStatus).toBe("in_progress");
    expect(state.shouldAutoCancel).toBe(false);
  });

  it("extends the accessible training window when renewal increases purchased weeks", () => {
    const beforeRenew = deriveSubscriptionEntitlementState({
      subscription: {
        status: "active",
        start_date: "2026-01-01T00:00:00.000Z",
        subscribed_weeks: 4,
      },
      planInstance: {
        id: "instance-1",
        status: "active",
        start_execution_day: 1,
        training_days: makePlan(15, 4),
      },
      executions: [{ day_index: 1, status: "completed" }],
      now: new Date("2026-02-01T00:00:00.000Z"),
    });
    const afterRenew = deriveSubscriptionEntitlementState({
      subscription: {
        status: "active",
        start_date: "2026-01-01T00:00:00.000Z",
        subscribed_weeks: 8,
      },
      planInstance: {
        id: "instance-1",
        status: "active",
        start_execution_day: 1,
        training_days: makePlan(15, 4),
      },
      executions: [{ day_index: 1, status: "completed" }],
      now: new Date("2026-02-01T00:00:00.000Z"),
    });

    expect(beforeRenew.maxAccessibleDayIndex).toBe(28);
    expect(afterRenew.maxAccessibleDayIndex).toBe(56);
    expect(afterRenew.remainingCredits).toBeGreaterThan(beforeRenew.remainingCredits);
  });

  it("marks exhausted credits as grace before the grace deadline", () => {
    const state = deriveSubscriptionEntitlementState({
      subscription: {
        status: "active",
        start_date: "2026-01-01T00:00:00.000Z",
        end_date: "2026-01-10T00:00:00.000Z",
        subscribed_weeks: 1,
      },
      planInstance: {
        id: "instance-1",
        status: "active",
        start_execution_day: 1,
        training_days: makePlan(1, 2),
      },
      executions: [
        { day_index: 1, status: "completed", completed_at: "2026-01-10T00:00:00.000Z" },
        { day_index: 2, status: "completed", completed_at: "2026-01-10T00:00:00.000Z" },
      ],
      now: new Date("2026-01-15T00:00:00.000Z"),
    });

    expect(state.entitlementStatus).toBe("grace");
    expect(state.canTrain).toBe(false);
    expect(state.canRenew).toBe(true);
    expect(state.shouldAutoCancel).toBe(false);
  });

  it("auto-cancels only after exhausted credits pass grace deadline", () => {
    const state = deriveSubscriptionEntitlementState({
      subscription: {
        status: "active",
        start_date: "2026-01-01T00:00:00.000Z",
        end_date: "2026-01-10T00:00:00.000Z",
        subscribed_weeks: 1,
      },
      planInstance: {
        id: "instance-1",
        status: "active",
        start_execution_day: 1,
        training_days: makePlan(1, 2),
      },
      executions: [
        { day_index: 1, status: "completed", completed_at: "2026-01-10T00:00:00.000Z" },
        { day_index: 2, status: "completed", completed_at: "2026-01-10T00:00:00.000Z" },
      ],
      now: new Date("2026-01-30T00:00:00.000Z"),
    });

    expect(state.entitlementStatus).toBe("exhausted");
    expect(state.shouldAutoCancel).toBe(true);
  });

  it("keeps plan completion separate from remaining entitlement", () => {
    const state = deriveSubscriptionEntitlementState({
      subscription: {
        status: "active",
        start_date: "2026-01-01T00:00:00.000Z",
        subscribed_weeks: 4,
      },
      planInstance: {
        id: "instance-1",
        status: "completed",
        start_execution_day: 1,
        training_days: makePlan(4, 2),
      },
      executions: [
        { day_index: 1, status: "completed" },
        { day_index: 2, status: "completed" },
      ],
      now: new Date("2026-01-05T00:00:00.000Z"),
    });

    expect(state.planProgressStatus).toBe("completed");
    expect(state.isPlanCompleted).toBe(true);
    expect(state.entitlementStatus).toBe("available");
    expect(state.remainingCredits).toBeGreaterThan(0);
    expect(state.lifecycleStatus).toBe("active");
    expect(state.canTrain).toBe(false);
  });

  it("keeps active no-plan subscriptions in no_plan instead of completed or grace", () => {
    const state = deriveSubscriptionEntitlementState({
      subscription: {
        status: "active",
        start_date: "2026-01-01T00:00:00.000Z",
        end_date: "2025-12-01T00:00:00.000Z",
        subscribed_weeks: 4,
      },
      planInstance: null,
      executions: [],
      now: new Date("2026-01-05T00:00:00.000Z"),
    });

    expect(state.entitlementStatus).toBe("no_plan");
    expect(state.planProgressStatus).toBe("no_plan");
    expect(state.lifecycleStatus).toBe("active");
    expect(state.isPlanCompleted).toBe(false);
    expect(state.canTrain).toBe(false);
  });

  it("does not reuse a stale end_date for active not-started plans with credits", () => {
    const state = deriveSubscriptionEntitlementState({
      subscription: {
        status: "active",
        start_date: null,
        end_date: "2025-12-01T00:00:00.000Z",
        subscribed_weeks: 4,
      },
      planInstance: {
        id: "instance-1",
        status: "active",
        start_execution_day: 1,
        training_days: makePlan(4, 3),
      },
      executions: [],
      now: new Date("2026-01-05T00:00:00.000Z"),
    });

    expect(state.entitlementStatus).toBe("not_started");
    expect(state.lifecycleStatus).toBe("active");
    expect(state.displayEndDate).toBeNull();
    expect(state.canTrain).toBe(true);
  });
});
