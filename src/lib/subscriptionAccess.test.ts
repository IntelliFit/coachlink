import { describe, expect, it } from "vitest";
import {
  evaluateSubscriptionPlanAccess,
  filterTrainingDaysByAccessWindow,
  getMaxAccessibleDayIndex,
  isSubscriptionExpired,
} from "./subscriptionAccess";

describe("subscriptionAccess", () => {
  it("calculates max accessible day index from subscribed weeks", () => {
    expect(getMaxAccessibleDayIndex(4)).toBe(28);
    expect(getMaxAccessibleDayIndex(8)).toBe(56);
    expect(getMaxAccessibleDayIndex(null)).toBeNull();
    expect(getMaxAccessibleDayIndex(0)).toBeNull();
  });

  it("treats non-active status as expired", () => {
    const expired = isSubscriptionExpired({
      status: "expired",
      end_date: null,
      subscribed_weeks: 4,
    });
    expect(expired).toBe(true);
  });

  it("treats past end_date as expired", () => {
    const now = new Date("2026-03-21T12:00:00.000Z");
    const expired = isSubscriptionExpired(
      {
        status: "active",
        end_date: "2026-03-20T23:59:59.000Z",
        subscribed_weeks: 4,
      },
      now,
    );
    expect(expired).toBe(true);
  });

  it("blocks out-of-scope day request when subscribed weeks are limited", () => {
    const decision = evaluateSubscriptionPlanAccess({
      subscription: {
        status: "active",
        end_date: "2026-03-30T00:00:00.000Z",
        subscribed_weeks: 4,
      },
      requestedDayIndex: 29,
      now: new Date("2026-03-21T12:00:00.000Z"),
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("PLAN_OUT_OF_SCOPE");
    expect(decision.maxAccessibleDayIndex).toBe(28);
  });

  it("allows in-scope day request", () => {
    const decision = evaluateSubscriptionPlanAccess({
      subscription: {
        status: "active",
        end_date: "2026-03-30T00:00:00.000Z",
        subscribed_weeks: 4,
      },
      requestedDayIndex: 28,
      now: new Date("2026-03-21T12:00:00.000Z"),
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBeUndefined();
  });

  it("keeps active subscription accessible when end_date is past", () => {
    const decision = evaluateSubscriptionPlanAccess({
      subscription: {
        status: "active",
        end_date: "2026-03-20T23:59:59.000Z",
        subscribed_weeks: 4,
      },
      requestedDayIndex: 7,
      now: new Date("2026-03-21T12:00:00.000Z"),
      trainingDays: [
        { dayIndex: 1, type: "training" },
        { dayIndex: 2, type: "training" },
        { dayIndex: 3, type: "training" },
      ],
      executions: [],
      startExecutionDay: 1,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBeUndefined();
  });

  it("filters training days by max accessible day index", () => {
    const trainingDays = [
      { dayIndex: 1, type: "training" },
      { dayIndex: 28, type: "training" },
      { dayIndex: 29, type: "training" },
    ];

    const filtered = filterTrainingDaysByAccessWindow(trainingDays, 28);
    expect(filtered).toEqual([
      { dayIndex: 1, type: "training" },
      { dayIndex: 28, type: "training" },
    ]);
  });
});

