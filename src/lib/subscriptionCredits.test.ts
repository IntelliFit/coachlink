import { describe, expect, it } from "vitest";
import {
  computeCreditsScope,
  computeUsedCredits,
  estimateRemainingDays,
} from "./subscriptionCredits";

function makePlan(params: { weeks: number; sessionsPerWeek: number }) {
  const days: Array<{ dayIndex: number; type: string }> = [];
  const { weeks, sessionsPerWeek } = params;
  for (let w = 0; w < weeks; w++) {
    for (let d = 1; d <= 7; d++) {
      const dayIndex = w * 7 + d;
      // first N days are training, rest are rest
      const type = d <= sessionsPerWeek ? "training" : "rest";
      days.push({ dayIndex, type });
    }
  }
  return days;
}

describe("subscriptionCredits (B1)", () => {
  it("computes totalCredits within first N weeks window (3 sessions/week, 4 weeks)", () => {
    const trainingDays = makePlan({ weeks: 8, sessionsPerWeek: 3 });
    const scope = computeCreditsScope({
      trainingDays,
      startExecutionDay: 1,
      subscribedWeeks: 4,
    });
    expect(scope.totalCredits).toBe(12);
    expect(scope.scopeStartDayIndex).toBe(1);
    expect(scope.scopeEndDayIndex).toBe(28);
  });

  it("credits scope is still the first N weeks even when startExecutionDay is mid-plan (migration)", () => {
    const trainingDays = makePlan({ weeks: 6, sessionsPerWeek: 3 });
    // week2 day1 => dayIndex 8
    const scope = computeCreditsScope({
      trainingDays,
      startExecutionDay: 8,
      subscribedWeeks: 4,
    });
    // credits window = [1..28] (first 4 weeks)
    // each full week has 3 training days => 12 total credits
    expect(scope.totalCredits).toBe(12);
    expect(scope.scopeStartDayIndex).toBe(1);
    expect(scope.scopeEndDayIndex).toBe(28);
  });

  it("caps window by plan max dayIndex", () => {
    const trainingDays = makePlan({ weeks: 2, sessionsPerWeek: 4 }); // only 14 days exist
    const scope = computeCreditsScope({
      trainingDays,
      startExecutionDay: 1,
      subscribedWeeks: 4, // asks for 28 days, but plan ends at 14
    });
    expect(scope.scopeEndDayIndex).toBe(14);
    // 2 weeks * 4 sessions = 8
    expect(scope.totalCredits).toBe(8);
  });

  it("computeUsedCredits counts unique completed training days only", () => {
    const trainingDays = makePlan({ weeks: 4, sessionsPerWeek: 3 });
    const scope = computeCreditsScope({
      trainingDays,
      startExecutionDay: 1,
      subscribedWeeks: 4,
    });
    const used = computeUsedCredits({
      eligibleTrainingDayIndexSet: scope.eligibleTrainingDayIndexSet,
      executions: [
        { day_index: 1, status: "completed" },
        { day_index: 1, status: "completed" }, // duplicate
        { day_index: 2, status: "in_progress" }, // ignored
        { day_index: 2, status: "completed" },
        { day_index: 99, status: "completed" }, // out of scope
      ],
      startExecutionDay: 1,
    });
    expect(used).toBe(2);
  });

  it("computeUsedCredits includes offline consumed credits before startExecutionDay (migration)", () => {
    const trainingDays = makePlan({ weeks: 8, sessionsPerWeek: 3 });
    const scope = computeCreditsScope({
      trainingDays,
      subscribedWeeks: 4,
      startExecutionDay: 8, // migrated to week2 day1
    });
    // In first 4 weeks, week1 has 3 training days (1,2,3) which are before day 8 => offline consumed
    const used = computeUsedCredits({
      eligibleTrainingDayIndexSet: scope.eligibleTrainingDayIndexSet,
      executions: [],
      startExecutionDay: 8,
    });
    expect(used).toBe(3);
  });

  it("estimateRemainingDays: uses plan cadence (credits/week) rather than assuming daily", () => {
    // 4-week plan, totalCredits=12 => 3 credits/week
    const days = estimateRemainingDays({
      subscribedWeeks: 4,
      totalCredits: 12,
      remainingCredits: 6,
      fallbackCreditsPerWeek: 3,
    });
    // 6 credits at 3/week => 2 weeks => ~14 days
    expect(days).toBe(14);
  });

  it("estimateRemainingDays returns 0 when remainingCredits<=0 or invalid inputs", () => {
    expect(
      estimateRemainingDays({
        subscribedWeeks: 4,
        totalCredits: 12,
        remainingCredits: 0,
      }),
    ).toBe(0);
    expect(
      estimateRemainingDays({
        subscribedWeeks: 0,
        totalCredits: 12,
        remainingCredits: 6,
      }),
    ).toBe(0);
  });
});

