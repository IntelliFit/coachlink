import { describe, expect, it } from "vitest";
import { buildFeedbackAdjustmentPatch } from "./feedbackPatch";
import type { AutomationPolicy } from "./types";

const autoPolicy: AutomationPolicy = {
  initialPlanMode: "auto_publish",
  feedbackAdjustmentMode: "auto_apply_low_risk",
  nextPhaseMode: "draft_notify",
  riskGuardMode: "strict",
  source: "coach",
};

function makeTrainingDays() {
  return [
    { dayIndex: 1, actionSets: [{ params: { sets: 3, reps: 10 } }] },
    { dayIndex: 2, actionSets: [{ params: { sets: 3, reps: 10 } }] },
    { dayIndex: 3, actionSets: [{ params: { sets: 3, reps: 10 } }] },
  ];
}

describe("buildFeedbackAdjustmentPatch", () => {
  it("forces high risk feedback into coach review without changing the plan", () => {
    const result = buildFeedbackAdjustmentPatch({
      trainingDays: makeTrainingDays(),
      feedbackContent: "I felt knee pain and numbness",
      feedbackDayIndex: 1,
      policy: autoPolicy,
    });

    expect(result.riskLevel).toBe("high");
    expect(result.requiresCoachReview).toBe(true);
    expect(result.updatedTrainingDays).toBeUndefined();
    expect(result.proposedPatch.kind).toBe("safety_review");
  });

  it("changes only future days that are not already executed", () => {
    const result = buildFeedbackAdjustmentPatch({
      trainingDays: makeTrainingDays(),
      feedbackContent: "too hard today",
      difficultyRating: 4,
      feedbackDayIndex: 1,
      blockedDayIndexes: [2],
      policy: autoPolicy,
    });

    expect(result.updatedTrainingDays?.[1].actionSets[0].params.sets).toBe(3);
    expect(result.updatedTrainingDays?.[2].actionSets[0].params.sets).toBe(2);
  });
});
