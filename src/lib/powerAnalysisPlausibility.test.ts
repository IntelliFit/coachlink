import { describe, expect, it } from "vitest";
import plausibilityLimits from "@coachlink/core/src/powerAnalysisPlausibility.json";
import { findPowerAnalysisRankingBlocker } from "./powerAnalysisPlausibility";
import { POWER_ANALYSIS_MODE_OPTIONS } from "@coachlink/core/src/powerAnalysisModes";

function metrics(reps: Array<{ displacementM: number; maxVelocityMps: number }>) {
  return {
    summary: {
      avgPowerW: 500,
      bestPowerW: 600,
      bestHorsepowerHp: 0.8,
      bestVelocityMps: Math.max(...reps.map((rep) => rep.maxVelocityMps)),
      avgAscentTimeS: 0.8,
      avgDisplacementM: 0.5,
    },
    reps: reps.map((rep, index) => ({ repIndex: index + 1, ascentTimeS: 0.8, avgPowerW: 500, horsepowerHp: 0.7, ...rep })),
  };
}

describe("findPowerAnalysisRankingBlocker", () => {
  it("lets a normal pull-up set rank", () => {
    expect(findPowerAnalysisRankingBlocker(metrics([{ displacementM: 0.55, maxVelocityMps: 1.4 }]), "pullup", 180)).toBeNull();
  });

  it("keeps a fast but human set on the board", () => {
    expect(findPowerAnalysisRankingBlocker(metrics([{ displacementM: 0.65, maxVelocityMps: 2.9 }]), "pullup", 180)).toBeNull();
  });

  it("blocks the 43 m/s tracking jump seen in production", () => {
    const set = metrics([
      { displacementM: 0.32, maxVelocityMps: 1.5 },
      { displacementM: 4.85, maxVelocityMps: 43 },
    ]);
    expect(findPowerAnalysisRankingBlocker(set, "pullup", 160)).toBe("velocity_beyond_body");
  });

  it("blocks travel no body can make even at a plausible speed", () => {
    const set = metrics([{ displacementM: 1.9, maxVelocityMps: 3 }]);
    expect(findPowerAnalysisRankingBlocker(set, "pullup", 170)).toBe("displacement_beyond_body");
  });

  it("skips the displacement check without a height", () => {
    expect(findPowerAnalysisRankingBlocker(metrics([{ displacementM: 1.9, maxVelocityMps: 3 }]), "pullup", 0)).toBeNull();
  });

  it("has limits for every non-custom mode", () => {
    const modes = POWER_ANALYSIS_MODE_OPTIONS.map((option) => option.value).filter((mode) => mode !== "custom");
    for (const mode of modes) {
      expect(plausibilityLimits.modes).toHaveProperty(mode);
    }
  });
});
