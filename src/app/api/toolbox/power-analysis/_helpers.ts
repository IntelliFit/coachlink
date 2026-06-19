import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type {
  PowerAnalysisJobDto,
  PowerAnalysisMetrics,
  PowerAnalysisMode,
} from "./types";

export const POWER_ANALYSIS_BUCKET = "videos" as const;
export const POWER_ANALYSIS_RETENTION_HOURS = 24;
export const POWER_ANALYSIS_MODE_VALUES: PowerAnalysisMode[] = [
  "pullup",
  "muscleup",
  "dip",
  "pushup",
  "squat",
];

const db = serviceRoleSupabase as any;

export function getPowerAnalysisLimits() {
  const maxVideoSizeMb = Math.max(
    1,
    Number(process.env.POWER_ANALYSIS_MAX_VIDEO_MB || 100),
  );
  const dailyLimit = Math.max(
    1,
    Number(process.env.POWER_ANALYSIS_DAILY_LIMIT || 5),
  );
  return { maxVideoSizeMb, dailyLimit };
}

function truthyEnv(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function envList(value: string | undefined) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isPowerAnalysisDailyLimitBypassed(userId: string) {
  if (truthyEnv(process.env.POWER_ANALYSIS_DISABLE_DAILY_LIMIT)) return true;
  if (process.env.NODE_ENV !== "production") return true;

  const bypassUserIds = envList(process.env.POWER_ANALYSIS_DAILY_LIMIT_BYPASS_USER_IDS);
  return bypassUserIds.includes(userId);
}

export function normalizeMode(value: unknown): PowerAnalysisMode | null {
  const mode = String(value || "").trim().toLowerCase();
  return POWER_ANALYSIS_MODE_VALUES.includes(mode as PowerAnalysisMode)
    ? (mode as PowerAnalysisMode)
    : null;
}

export function numberInRange(value: unknown, min: number, max: number): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export function buildPowerAnalysisPath(params: {
  userId: string;
  jobId: string;
  filename: string;
}) {
  const ext = getSafeVideoExt(params.filename);
  return `toolbox/power-analysis/tmp/${params.userId}/${params.jobId}/input.${ext}`;
}

export function buildPowerAnalysisOutputPath(params: {
  userId: string;
  jobId: string;
}) {
  return `toolbox/power-analysis/tmp/${params.userId}/${params.jobId}/output.mp4`;
}

export function getSafeVideoExt(filename: string) {
  const ext = String(filename || "")
    .split(".")
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (!ext) return "mp4";
  return ["mp4", "mov", "webm", "mkv", "avi"].includes(ext) ? ext : "mp4";
}

export function isSupportedVideoContentType(contentType: string) {
  const ct = String(contentType || "").toLowerCase();
  return ct.startsWith("video/");
}

export function mapPowerAnalysisJob(row: any): PowerAnalysisJobDto {
  const metrics = normalizeMetrics(row?.metrics_json);
  const metadata = normalizeObject(row?.metadata);
  const externalLoadKg = nonNegativeNumber(
    metadata.external_load_kg ?? metadata.externalLoadKg,
  );
  const expiresAt = String(row?.expires_at || "");
  const expired = expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;
  const status = expired && row?.status !== "done" ? "expired" : row?.status;

  return {
    id: String(row?.id || ""),
    mode: normalizeMode(row?.mode) || "pullup",
    heightCm: Number(row?.height_cm || 0),
    weightKg: Number(row?.weight_kg || 0),
    externalLoadKg,
    status,
    progress: Number(row?.progress || 0),
    metrics,
    llmSummary: row?.llm_summary || null,
    errorMessage: row?.error_message || null,
    expiresAt,
    createdAt: String(row?.created_at || ""),
    completedAt: row?.completed_at || null,
    canDownload:
      row?.status === "done" &&
      Boolean(row?.output_storage_path) &&
      Boolean(expiresAt) &&
      !expired,
  };
}

function normalizeObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function nonNegativeNumber(value: unknown) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function normalizeMetrics(value: unknown): PowerAnalysisMetrics | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as any;
  const mode = normalizeMode(raw.mode) || "pullup";
  const mass = raw.mass && typeof raw.mass === "object" ? raw.mass : null;
  const reps = Array.isArray(raw.reps)
    ? raw.reps.map((item: any, index: number) => ({
        repIndex: Number(item.repIndex ?? item.rep_index ?? index + 1),
        displacementM: Number(item.displacementM ?? item.displacement_m ?? 0),
        ascentTimeS: Number(item.ascentTimeS ?? item.ascent_time_s ?? 0),
        avgPowerW: Number(item.avgPowerW ?? item.power ?? item.avg_power_w ?? 0),
        horsepowerHp: Number(item.horsepowerHp ?? item.horsepower ?? item.horsepower_hp ?? 0),
        maxVelocityMps: Number(item.maxVelocityMps ?? item.max_velocity ?? item.max_velocity_mps ?? 0),
      }))
    : [];

  const summary = raw.summary || {};
  return {
    mode,
    mass: mass
      ? {
          bodyWeightKg: Number(mass.bodyWeightKg ?? mass.body_weight_kg ?? 0),
          externalLoadKg: Number(mass.externalLoadKg ?? mass.external_load_kg ?? 0),
          effectiveMassKg: Number(mass.effectiveMassKg ?? mass.effective_mass_kg ?? 0),
        }
      : undefined,
    repCount: Number(raw.repCount ?? raw.rep_count ?? reps.length),
    summary: {
      avgPowerW: Number(summary.avgPowerW ?? summary.avg_power_w ?? 0),
      bestPowerW: Number(summary.bestPowerW ?? summary.best_power_w ?? 0),
      bestHorsepowerHp: Number(summary.bestHorsepowerHp ?? summary.best_horsepower_hp ?? 0),
      bestVelocityMps: Number(summary.bestVelocityMps ?? summary.best_velocity_mps ?? 0),
      avgAscentTimeS: Number(summary.avgAscentTimeS ?? summary.avg_ascent_time_s ?? 0),
      avgDisplacementM: Number(summary.avgDisplacementM ?? summary.avg_displacement_m ?? 0),
    },
    reps,
    notes: Array.isArray(raw.notes) ? raw.notes.map(String) : undefined,
  };
}

export async function getOwnedPowerAnalysisJob(jobId: string, userId: string) {
  const { data, error } = await db
    .from("tool_power_analysis_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function expirePowerAnalysisJobIfNeeded(row: any) {
  if (!row || row.status === "expired") return row;
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (!expiresAt || expiresAt > Date.now()) return row;

  const paths = [row.input_storage_path, row.output_storage_path].filter(Boolean);
  if (paths.length > 0) {
    await db.storage.from(POWER_ANALYSIS_BUCKET).remove(paths).catch(() => null);
  }

  const { data } = await db
    .from("tool_power_analysis_jobs")
    .update({ status: "expired", progress: 100 })
    .eq("id", row.id)
    .select("*")
    .maybeSingle();

  return data || { ...row, status: "expired", progress: 100 };
}

export function makeFallbackPowerSummary(metrics: PowerAnalysisMetrics) {
  const repCount = metrics.repCount || metrics.reps.length;
  if (repCount <= 0) {
    return "这段视频没有稳定识别到完整上升动作。建议换一个全身无遮挡、侧前方或正前方、动作开始前后各留 1 秒的视频再测。";
  }

  const bestHp = metrics.summary.bestHorsepowerHp;
  const bestPower = metrics.summary.bestPowerW;
  const bestVelocity = metrics.summary.bestVelocityMps;
  const avgTime = metrics.summary.avgAscentTimeS;
  return [
    `本次共识别到 ${repCount} 次有效上升动作，最高功率约 ${bestPower.toFixed(0)} W（${bestHp.toFixed(2)} hp），最高上升速度约 ${bestVelocity.toFixed(2)} m/s。`,
    `平均上升时间约 ${avgTime.toFixed(2)} 秒，可把这个结果作为同一拍摄角度下的自我对比基线。`,
    "如果想继续提升，优先关注动作启动速度、顶端过渡效率和后半程速度衰减。视频角度、遮挡和身高标定会影响结果，因此不要把它当作正式实验室测量。",
  ].join("\n");
}
