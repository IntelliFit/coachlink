import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { normalizePowerAnalysisQuality } from "@/lib/powerAnalysisEntitlements";
import type {
  PowerAnalysisJobDto,
  PowerAnalysisQueueInfoDto,
  PowerAnalysisMetrics,
  PowerAnalysisMode,
  PowerAnalysisRankingDto,
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

function positiveEnvNumber(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getPowerAnalysisStaleThresholdsMs() {
  return {
    queuedMs: positiveEnvNumber(
      process.env.POWER_ANALYSIS_QUEUED_STALE_MINUTES,
      10,
    ) * 60 * 1000,
    processingMs: positiveEnvNumber(
      process.env.POWER_ANALYSIS_PROCESSING_STALE_MINUTES,
      45,
    ) * 60 * 1000,
  };
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
    llmSummary: row?.llm_summary
      ? String(row.llm_summary).replace(/\*/g, "").trim()
      : null,
    errorMessage: row?.error_message || null,
    expiresAt,
    createdAt: String(row?.created_at || ""),
    completedAt: row?.completed_at || null,
    canDownload:
      row?.status === "done" &&
      Boolean(row?.output_storage_path) &&
      Boolean(expiresAt) &&
      !expired,
    quality: metadata.quality === "original" ? "original" : "compressed",
    overlayLanguage: metadata.overlay_language === "en" ? "en" : "zh",
  };
}

function applyQueueTopic(query: any, queueTopic: string) {
  return queueTopic ? query.eq("queue_topic", queueTopic) : query;
}

export async function getPowerAnalysisQueueInfo(row: any): Promise<PowerAnalysisQueueInfoDto | null> {
  if (!row || (row.status !== "queued" && row.status !== "processing")) return null;

  const now = new Date().toISOString();
  const queueTopic = String(row.queue_topic || "").trim();
  const createdAt = String(row.created_at || "");

  const processingQuery = applyQueueTopic(
    db
      .from("tool_power_analysis_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "processing")
      .gt("expires_at", now),
    queueTopic,
  );

  const totalQueuedQuery = applyQueueTopic(
    db
      .from("tool_power_analysis_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued")
      .gt("expires_at", now),
    queueTopic,
  );

  const queuedAheadQueryBase = applyQueueTopic(
    db
      .from("tool_power_analysis_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued")
      .gt("expires_at", now)
      .neq("id", row.id),
    queueTopic,
  );
  const queuedAheadQuery = createdAt ? queuedAheadQueryBase.lt("created_at", createdAt) : queuedAheadQueryBase;

  const [
    { count: processingCount, error: processingError },
    { count: totalQueuedCount, error: totalQueuedError },
    { count: queuedAheadCount, error: queuedAheadError },
  ] = await Promise.all([processingQuery, totalQueuedQuery, queuedAheadQuery]);

  if (processingError || totalQueuedError || queuedAheadError) {
    console.warn("[power-analysis] queue info lookup failed:", {
      processingError: processingError?.message,
      totalQueuedError: totalQueuedError?.message,
      queuedAheadError: queuedAheadError?.message,
    });
    return null;
  }

  const processingAhead = row.status === "queued" ? Number(processingCount || 0) : 0;
  const queuedAhead = row.status === "queued" ? Number(queuedAheadCount || 0) : 0;
  return {
    jobsAhead: processingAhead + queuedAhead,
    queuedAhead,
    processingAhead,
    totalQueued: Number(totalQueuedCount || 0),
  };
}

export async function mapPowerAnalysisJobWithQueueInfo(row: any): Promise<PowerAnalysisJobDto> {
  const dto = mapPowerAnalysisJob(row);
  dto.queueInfo = await getPowerAnalysisQueueInfo(row);
  if (dto.status === "done" && dto.metrics && row?.user_id) {
    dto.ranking = await syncPowerAnalysisRanking(row.id, row.user_id);
  }
  return dto;
}

export async function syncPowerAnalysisRanking(
  jobId: string,
  userId: string,
): Promise<PowerAnalysisRankingDto | null> {
  const { data, error } = await db.rpc("record_power_analysis_best", {
    p_job_id: jobId,
    p_user_id: userId,
  });

  if (error) {
    console.warn("[power-analysis] ranking sync failed:", {
      jobId,
      code: error.code,
      message: error.message,
    });
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    scope: "coachlink_nationwide_participants",
    scopeLabel: "CoachLink 全国参赛用户",
    power: {
      rank: Number(row.power_rank || 0),
      participantTotal: Number(row.power_participant_total || 0),
      percentile: Number(row.power_percentile || 0),
      bestValue: Number(row.best_power_w || 0),
      isPersonalBest: Boolean(row.is_power_personal_best),
    },
    speed: {
      rank: Number(row.speed_rank || 0),
      participantTotal: Number(row.speed_participant_total || 0),
      percentile: Number(row.speed_percentile || 0),
      bestValue: Number(row.best_velocity_mps || 0),
      isPersonalBest: Boolean(row.is_speed_personal_best),
    },
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
  const video = raw.video && typeof raw.video === "object" ? raw.video : null;
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
  const timeSeries = Array.isArray(raw.timeSeries ?? raw.time_series)
    ? (raw.timeSeries ?? raw.time_series)
        .slice(0, 1200)
        .map((item: any) => ({
          timeS: nonNegativeNumber(item.timeS ?? item.time_s),
          displacementM: nonNegativeNumber(item.displacementM ?? item.displacement_m),
          velocityMps: nonNegativeNumber(item.velocityMps ?? item.velocity_mps),
          powerW: nonNegativeNumber(item.powerW ?? item.power_w),
        }))
    : undefined;
  const ratingSource = raw.rating && typeof raw.rating === "object" ? raw.rating : null;
  const ratingLevel = String(ratingSource?.level || "");
  const rating = ["low", "steady", "powerful", "beast"].includes(ratingLevel)
    ? {
        level: ratingLevel as "low" | "steady" | "powerful" | "beast",
        normalizedPowerWPerKg: nonNegativeNumber(
          ratingSource.normalizedPowerWPerKg ?? ratingSource.normalized_power_w_per_kg,
        ),
        labelZh: String(ratingSource.labelZh ?? ratingSource.label_zh ?? ""),
        labelEn: String(ratingSource.labelEn ?? ratingSource.label_en ?? ""),
        descriptionZh: String(ratingSource.descriptionZh ?? ratingSource.description_zh ?? ""),
        descriptionEn: String(ratingSource.descriptionEn ?? ratingSource.description_en ?? ""),
      }
    : undefined;
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
    timeSeries,
    rating,
    video: video
      ? {
          inputSizeBytes: nonNegativeNumber(video.inputSizeBytes ?? video.input_size_bytes),
          outputSizeBytes: nonNegativeNumber(video.outputSizeBytes ?? video.output_size_bytes),
          inputHasAudio: typeof video.inputHasAudio === "boolean" ? video.inputHasAudio : undefined,
          outputHasAudio: typeof video.outputHasAudio === "boolean" ? video.outputHasAudio : undefined,
          audioPreserved: typeof video.audioPreserved === "boolean" ? video.audioPreserved : undefined,
          quality: normalizePowerAnalysisQuality(video.quality) || undefined,
        }
      : undefined,
    notes: Array.isArray(raw.notes) ? raw.notes.map(String) : undefined,
    video: video
      ? {
          inputHasAudio: typeof video.inputHasAudio === "boolean" ? video.inputHasAudio : undefined,
          outputHasAudio: typeof video.outputHasAudio === "boolean" ? video.outputHasAudio : undefined,
          audioPreserved: typeof video.audioPreserved === "boolean" ? video.audioPreserved : undefined,
        }
      : undefined,
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

function getTime(value: unknown) {
  const time = value ? new Date(String(value)).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function getStaleAnchor(row: any) {
  if (row?.status === "queued") {
    return getTime(row.enqueued_at) || getTime(row.updated_at) || getTime(row.created_at);
  }
  if (row?.status === "processing") {
    return getTime(row.updated_at) || getTime(row.started_at) || getTime(row.created_at);
  }
  return 0;
}

function isStaleActivePowerAnalysisJob(row: any, now = Date.now()) {
  if (!row || (row.status !== "queued" && row.status !== "processing")) return false;
  const { queuedMs, processingMs } = getPowerAnalysisStaleThresholdsMs();
  const anchor = getStaleAnchor(row);
  if (!anchor) return false;
  const threshold = row.status === "queued" ? queuedMs : processingMs;
  return now - anchor > threshold;
}

export async function failStalePowerAnalysisJobIfNeeded(row: any) {
  if (!isStaleActivePowerAnalysisJob(row)) return row;

  const { data } = await db
    .from("tool_power_analysis_jobs")
    .update({
      status: "failed",
      progress: 100,
      error_message: "任务长时间没有进展，已自动释放名额，请重新上传分析",
      completed_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .in("status", ["queued", "processing"])
    .select("*")
    .maybeSingle();

  return data || {
    ...row,
    status: "failed",
    progress: 100,
    error_message: "任务长时间没有进展，已自动释放名额，请重新上传分析",
    completed_at: new Date().toISOString(),
  };
}

export async function failStalePowerAnalysisJobsForUser(userId: string) {
  const { data: rows, error } = await db
    .from("tool_power_analysis_jobs")
    .select("id, status, progress, created_at, updated_at, enqueued_at, started_at, expires_at")
    .eq("user_id", userId)
    .in("status", ["queued", "processing"])
    .gt("expires_at", new Date().toISOString())
    .limit(20);

  if (error) {
    console.warn("[power-analysis] stale job lookup failed:", error.message);
    return 0;
  }

  const now = Date.now();
  const staleIds = (rows || [])
    .filter((row: any) => isStaleActivePowerAnalysisJob(row, now))
    .map((row: any) => row.id)
    .filter(Boolean);

  if (staleIds.length === 0) return 0;

  const { error: updateError } = await db
    .from("tool_power_analysis_jobs")
    .update({
      status: "failed",
      progress: 100,
      error_message: "任务长时间没有进展，已自动释放名额，请重新上传分析",
      completed_at: new Date().toISOString(),
    })
    .in("id", staleIds)
    .in("status", ["queued", "processing"]);

  if (updateError) {
    console.warn("[power-analysis] stale job release failed:", updateError.message);
    return 0;
  }

  return staleIds.length;
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
