import { serviceRoleSupabase } from "@/lib/supabaseClient";

export type PowerAnalysisQuality = "compressed" | "original";
export type PowerAnalysisOverlayLanguage = "zh" | "en";
export type PowerAnalysisMembershipTier = "free" | "basic" | "premium" | "trial";

export interface PowerAnalysisEntitlements {
  tier: PowerAnalysisMembershipTier;
  canUseOriginalQuality: boolean;
  availableQualities: PowerAnalysisQuality[];
  maxVideoSizeMb: number;
  maxDurationSeconds: number;
  dailyLimit: number;
}

const db = serviceRoleSupabase as any;

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function normalizeTier(value: unknown): PowerAnalysisMembershipTier {
  const tier = String(value || "").trim().toLowerCase();
  if (tier === "basic" || tier === "premium" || tier === "trial") return tier;
  return "free";
}

function isActiveMembership(row: any) {
  if (!row || String(row.status || "").toLowerCase() !== "active") return false;
  if (!row.end_date) return true;
  const endAt = new Date(row.end_date).getTime();
  return Number.isFinite(endAt) && endAt > Date.now();
}

export function buildPowerAnalysisEntitlements(
  tierValue: unknown,
): PowerAnalysisEntitlements {
  const tier = normalizeTier(tierValue);
  const freeMaxMb = positiveInteger(
    process.env.POWER_ANALYSIS_FREE_MAX_VIDEO_MB || process.env.POWER_ANALYSIS_MAX_VIDEO_MB,
    100,
  );
  const freeDuration = positiveInteger(process.env.POWER_ANALYSIS_FREE_MAX_DURATION_SECONDS, 30);
  const freeDaily = positiveInteger(
    process.env.POWER_ANALYSIS_FREE_DAILY_LIMIT || process.env.POWER_ANALYSIS_DAILY_LIMIT,
    5,
  );

  if (tier === "basic") {
    return {
      tier,
      canUseOriginalQuality: true,
      availableQualities: ["compressed", "original"],
      maxVideoSizeMb: positiveInteger(process.env.POWER_ANALYSIS_BASIC_MAX_VIDEO_MB, 200),
      maxDurationSeconds: positiveInteger(process.env.POWER_ANALYSIS_BASIC_MAX_DURATION_SECONDS, 60),
      dailyLimit: positiveInteger(process.env.POWER_ANALYSIS_BASIC_DAILY_LIMIT, 20),
    };
  }

  if (tier === "premium" || tier === "trial") {
    return {
      tier,
      canUseOriginalQuality: true,
      availableQualities: ["compressed", "original"],
      maxVideoSizeMb: positiveInteger(process.env.POWER_ANALYSIS_PREMIUM_MAX_VIDEO_MB, 500),
      maxDurationSeconds: positiveInteger(process.env.POWER_ANALYSIS_PREMIUM_MAX_DURATION_SECONDS, 120),
      dailyLimit: positiveInteger(process.env.POWER_ANALYSIS_PREMIUM_DAILY_LIMIT, 100),
    };
  }

  return {
    tier: "free",
    canUseOriginalQuality: false,
    availableQualities: ["compressed"],
    maxVideoSizeMb: freeMaxMb,
    maxDurationSeconds: freeDuration,
    dailyLimit: freeDaily,
  };
}

export async function getPowerAnalysisEntitlements(
  userId: string,
): Promise<PowerAnalysisEntitlements> {
  const { data, error } = await db
    .from("student_memberships")
    .select("tier,status,end_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[power-analysis/entitlements] membership lookup failed:", error.message);
    return buildPowerAnalysisEntitlements("free");
  }

  return buildPowerAnalysisEntitlements(isActiveMembership(data) ? data?.tier : "free");
}

export function normalizePowerAnalysisQuality(
  value: unknown,
): PowerAnalysisQuality | null {
  const quality = String(value || "").trim().toLowerCase();
  return quality === "compressed" || quality === "original" ? quality : null;
}

export function normalizePowerAnalysisOverlayLanguage(
  value: unknown,
): PowerAnalysisOverlayLanguage {
  return String(value || "").trim().toLowerCase() === "en" ? "en" : "zh";
}
