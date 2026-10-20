import { describe, expect, it } from "vitest";
import {
  getPowerAnalysisModeLabel,
  isBarbellPowerAnalysisMode,
  normalizePowerAnalysisMode,
  parsePowerAnalysisLoadInput,
} from "@coachlink/core/src/powerAnalysisModes";
import type { PowerAnalysisMetrics } from "@/app/api/toolbox/power-analysis/types";
import {
  buildFallbackAssessmentLines,
  buildPowerAnalysisPromptContext,
  describeMeasurementZh,
  normalizePowerAnalysisAssessment,
  normalizePowerAnalysisMeasurement,
} from "./powerAnalysisAssessment";

const deadliftMetrics = (): PowerAnalysisMetrics => ({
  mode: "deadlift",
  mass: { bodyWeightKg: 80, externalLoadKg: 140, effectiveMassKg: 140 },
  repCount: 3,
  summary: {
    avgPowerW: 660,
    bestPowerW: 728,
    bestHorsepowerHp: 0.99,
    bestVelocityMps: 0.8,
    avgAscentTimeS: 1.4,
    avgDisplacementM: 0.68,
    bestMeanVelocityMps: 0.5,
    velocityLossPct: 12,
  },
  reps: [],
  timeSeries: [{ timeS: 0, displacementM: 0, velocityMps: 0, powerW: 0 }],
  measurement: {
    target: "barbell_plate",
    anchorLabelZh: "杠铃片中心",
    scaleSource: "plate_diameter",
    confidence: "high",
    plateDiameterCm: 45,
    trackingCoverage: 0.92,
    warningsZh: [],
  },
  assessment: normalizePowerAnalysisAssessment({
    version: "1.0.0",
    view: "side",
    viewLabelZh: "侧面",
    recommendedViewZh: "侧面",
    checks: [
      { code: "deadlift.hips_first", titleZh: "起杠时臀部先起", status: "issue", detailZh: "第 2 次臀部先起", repIndexes: [2], timesS: [4.1], value: 18, unit: "°" },
      { code: "deadlift.lockout", titleZh: "顶端锁定", status: "good", detailZh: "每次都锁定", repIndexes: [], timesS: [], value: 176, unit: "°" },
      { code: "deadlift.spine", titleZh: "背部弯曲", status: "unavailable", detailZh: "无法判断", repIndexes: [], timesS: [], value: null, unit: "" },
    ],
  }),
});

describe("power analysis modes", () => {
  it("accepts the barbell lifts and keeps unknown modes out", () => {
    expect(normalizePowerAnalysisMode("Bench_Press")).toBe("bench_press");
    expect(normalizePowerAnalysisMode("snatch")).toBeNull();
    expect(isBarbellPowerAnalysisMode("deadlift")).toBe(true);
    expect(isBarbellPowerAnalysisMode("squat")).toBe(false);
    expect(getPowerAnalysisModeLabel("back_squat")).toBe("杠铃深蹲");
  });

  it("validates bodyweight extra load within 0-250 kg", () => {
    expect(parsePowerAnalysisLoadInput("pullup", undefined, undefined)).toEqual({ ok: true, externalLoadKg: 0, plateDiameterCm: null });
    expect(parsePowerAnalysisLoadInput("pullup", 300, undefined).ok).toBe(false);
  });

  it("requires a bar mass for barbell lifts and defaults the plate to 45 cm", () => {
    expect(parsePowerAnalysisLoadInput("deadlift", 0, undefined).ok).toBe(false);
    expect(parsePowerAnalysisLoadInput("deadlift", 320, undefined)).toEqual({ ok: true, externalLoadKg: 320, plateDiameterCm: 45 });
    expect(parsePowerAnalysisLoadInput("bench_press", 100, 60).ok).toBe(false);
    expect(parsePowerAnalysisLoadInput("bench_press", 100, "35")).toEqual({ ok: true, externalLoadKg: 100, plateDiameterCm: 35 });
  });
});

describe("power analysis assessment parsing", () => {
  it("drops malformed checks and recounts statuses", () => {
    const parsed = normalizePowerAnalysisAssessment({
      view: "sideways",
      checks: [
        { code: "a", titleZh: "A", status: "warn", detailZh: "x", repIndexes: [1, "bad"], timesS: [1.5] },
        { titleZh: "missing code" },
        { code: "b", titleZh: "B", status: "made-up" },
      ],
      counts: { warn: 99 },
    });
    expect(parsed?.view).toBe("unknown");
    expect(parsed?.checks.map((check) => check.status)).toEqual(["warn", "unavailable"]);
    expect(parsed?.checks[0].repIndexes).toEqual([1]);
    expect(parsed?.counts.warn).toBe(1);
    expect(parsed?.counts.unavailable).toBe(1);
  });

  it("returns undefined for results from the old analyzer", () => {
    expect(normalizePowerAnalysisAssessment(undefined)).toBeUndefined();
    expect(normalizePowerAnalysisMeasurement({})).toBeUndefined();
  });

  it("describes plate measurement with coverage", () => {
    expect(describeMeasurementZh(deadliftMetrics().measurement)).toContain("追踪覆盖 92%");
  });

  it("names the rough frame-height scale instead of claiming height calibration", () => {
    const text = describeMeasurementZh({
      target: "body_anchor",
      anchorLabelZh: "肩部",
      scaleSource: "frame_fallback",
      confidence: "low",
      warningsZh: [],
    });
    expect(text).toContain("按画面高度粗略估算");
    expect(text).not.toContain("按身高换算");
  });
});

describe("power analysis summary inputs", () => {
  it("gives the model the checks but not the time series", () => {
    const context = buildPowerAnalysisPromptContext(deadliftMetrics());
    expect(context).toContain("动作类型: 硬拉");
    expect(context).toContain("[明显问题] 起杠时臀部先起");
    expect(context).toContain("[无法评估] 背部弯曲");
    expect(context).not.toContain("timeSeries");
  });

  it("lists flagged and unavailable items in the fallback text", () => {
    const lines = buildFallbackAssessmentLines(deadliftMetrics());
    expect(lines[0]).toContain("起杠时臀部先起");
    expect(lines[1]).toContain("背部弯曲");
  });
});
