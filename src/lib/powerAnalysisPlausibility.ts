import plausibilityLimits from "@coachlink/core/src/powerAnalysisPlausibility.json";
import type { PowerAnalysisMetrics, PowerAnalysisMode } from "@/app/api/toolbox/power-analysis/types";

interface ModeLimits {
  maxPeakVelocityMps: number | null;
  maxDisplacementHeightRatio: number | null;
}

const MODE_LIMITS = plausibilityLimits.modes as Record<string, ModeLimits>;

export type PowerAnalysisRankingBlocker = "velocity_beyond_body" | "displacement_beyond_body";

function finite(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Why a finished result must stay off the leaderboards, or null when it may rank.
 * Same limits the analyzer applies per rep (2.1.0+); this also catches results from
 * older analyzer versions and anything the analyzer missed.
 */
export function findPowerAnalysisRankingBlocker(
  metrics: Pick<PowerAnalysisMetrics, "summary" | "reps"> | null | undefined,
  mode: PowerAnalysisMode,
  heightCm: number,
): PowerAnalysisRankingBlocker | null {
  const limits = MODE_LIMITS[mode];
  if (!metrics || !limits) return null;
  const velocityCap = limits.maxPeakVelocityMps;
  const displacementCapM = limits.maxDisplacementHeightRatio && heightCm > 0
    ? (limits.maxDisplacementHeightRatio * heightCm) / 100
    : null;
  const reps = Array.isArray(metrics.reps) ? metrics.reps : [];

  if (velocityCap) {
    const peaks = [finite(metrics.summary?.bestVelocityMps), ...reps.map((rep) => finite(rep.maxVelocityMps))];
    if (peaks.some((value) => value > velocityCap)) return "velocity_beyond_body";
  }
  if (displacementCapM && reps.some((rep) => finite(rep.displacementM) > displacementCapM)) {
    return "displacement_beyond_body";
  }
  return null;
}
