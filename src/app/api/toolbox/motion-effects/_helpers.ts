import { createHmac, timingSafeEqual } from "node:crypto";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { getTaskQueueConfig } from "@/lib/taskqueue/config";
import type { TaskQueueConfig } from "@/lib/taskqueue/types";
import type { MotionEffectJobDto, MotionEffectResult } from "./types";

export const MOTION_EFFECTS_BUCKET = "videos" as const;
export const MOTION_EFFECTS_RETENTION_HOURS = 24;
const db = serviceRoleSupabase as any;

function getDownloadSecret() {
  return (
    process.env.MOTION_EFFECTS_DOWNLOAD_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.CRON_SECRET ||
    ""
  ).trim();
}

export function createMotionEffectDownloadToken(jobId: string, userId: string, expires: number) {
  const secret = getDownloadSecret();
  if (!secret) return "";
  return createHmac("sha256", secret)
    .update(`${jobId}:${userId}:${expires}`)
    .digest("base64url");
}

export function verifyMotionEffectDownloadToken(params: {
  jobId: string;
  userId: string;
  expires: number;
  token: string;
}) {
  if (!Number.isFinite(params.expires) || params.expires < Math.floor(Date.now() / 1000)) {
    return false;
  }
  const expected = createMotionEffectDownloadToken(
    params.jobId,
    params.userId,
    params.expires,
  );
  if (!expected || !params.token) return false;
  const actualBuffer = Buffer.from(params.token);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function positiveNumber(value: string | undefined, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function getMotionEffectLimits() {
  return {
    maxVideoSizeMb: positiveNumber(process.env.MOTION_EFFECTS_MAX_VIDEO_MB, 100),
    maxDurationSeconds: positiveNumber(process.env.MOTION_EFFECTS_MAX_DURATION_SECONDS, 30),
    dailyLimit: positiveNumber(process.env.MOTION_EFFECTS_DAILY_LIMIT, 5),
  };
}

export function getMotionEffectQueueConfig(): TaskQueueConfig {
  return getTaskQueueConfig(
    {
      ...process.env,
      TASK_QUEUE_DRIVER:
        process.env.MOTION_EFFECTS_TASK_QUEUE_DRIVER || process.env.TASK_QUEUE_DRIVER,
      TASK_QUEUE_BROKERS:
        process.env.MOTION_EFFECTS_TASK_QUEUE_BROKERS || process.env.TASK_QUEUE_BROKERS,
      TASK_QUEUE_TOPIC:
        process.env.MOTION_EFFECTS_TASK_QUEUE_TOPIC ||
        "coachlink-motion-effects-tasks-main",
      TASK_QUEUE_CONSUMER_GROUP:
        process.env.MOTION_EFFECTS_TASK_QUEUE_CONSUMER_GROUP ||
        "coachlink-motion-effects-workers",
      TASK_QUEUE_CLIENT_ID:
        process.env.MOTION_EFFECTS_TASK_QUEUE_CLIENT_ID ||
        "coachlink-motion-effects-web",
    },
    { requireTopic: true },
  );
}

export function getSafeVideoExt(filename: string) {
  const ext = String(filename || "")
    .split(".")
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return ext && ["mp4", "mov", "webm", "mkv", "avi"].includes(ext) ? ext : "mp4";
}

export function isSupportedVideoContentType(contentType: string) {
  return String(contentType || "").toLowerCase().startsWith("video/");
}

export function buildMotionEffectInputPath(params: {
  userId: string;
  jobId: string;
  filename: string;
}) {
  return `toolbox/motion-effects/tmp/${params.userId}/${params.jobId}/input.${getSafeVideoExt(params.filename)}`;
}

export function buildMotionEffectOutputPath(params: {
  userId: string;
  jobId: string;
}) {
  return `toolbox/motion-effects/tmp/${params.userId}/${params.jobId}/output.mp4`;
}

function normalizeResult(value: unknown): MotionEffectResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  return {
    analyzedFrames: Number(raw.analyzedFrames ?? raw.analyzed_frames ?? 0),
    handFrames: Number(raw.handFrames ?? raw.hand_frames ?? 0),
    peakPairs: Number(raw.peakPairs ?? raw.peak_pairs ?? 0),
    pairFrameCounts: Array.isArray(raw.pairFrameCounts ?? raw.pair_frame_counts)
      ? (raw.pairFrameCounts ?? raw.pair_frame_counts as unknown[]).map(Number).slice(0, 6)
      : [0, 0, 0, 0, 0, 0],
    durationSeconds: Number(raw.durationSeconds ?? raw.duration_seconds ?? 0),
    audioPreserved: Boolean(raw.audioPreserved ?? raw.audio_preserved),
  };
}

export function mapMotionEffectJob(row: any): MotionEffectJobDto {
  const expiresAt = String(row?.expires_at || "");
  const expired = expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;
  const status = expired && row?.status !== "done" ? "expired" : row?.status;
  return {
    id: String(row?.id || ""),
    status,
    progress: Number(row?.progress || 0),
    result: normalizeResult(row?.result_json),
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

function applyQueueTopic(query: any, queueTopic: string) {
  return queueTopic ? query.eq("queue_topic", queueTopic) : query;
}

export async function mapMotionEffectJobWithQueueInfo(row: any) {
  const dto = mapMotionEffectJob(row);
  if (!row || !["queued", "processing"].includes(row.status)) return dto;

  const now = new Date().toISOString();
  const topic = String(row.queue_topic || "");
  const processing = applyQueueTopic(
    db.from("tool_video_render_jobs").select("id", { count: "exact", head: true })
      .eq("status", "processing").gt("expires_at", now),
    topic,
  );
  const totalQueued = applyQueueTopic(
    db.from("tool_video_render_jobs").select("id", { count: "exact", head: true })
      .eq("status", "queued").gt("expires_at", now),
    topic,
  );
  let queuedAhead = applyQueueTopic(
    db.from("tool_video_render_jobs").select("id", { count: "exact", head: true })
      .eq("status", "queued").gt("expires_at", now).neq("id", row.id),
    topic,
  );
  if (row.created_at) queuedAhead = queuedAhead.lt("created_at", row.created_at);

  const [p, q, a] = await Promise.all([processing, totalQueued, queuedAhead]);
  if (!p.error && !q.error && !a.error) {
    dto.queueInfo = {
      jobsAhead: row.status === "queued" ? Number(p.count || 0) + Number(a.count || 0) : 0,
      processingAhead: row.status === "queued" ? Number(p.count || 0) : 0,
      queuedAhead: row.status === "queued" ? Number(a.count || 0) : 0,
      totalQueued: Number(q.count || 0),
    };
  }
  return dto;
}

export async function getOwnedMotionEffectJob(jobId: string, userId: string) {
  const { data, error } = await db
    .from("tool_video_render_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function expireMotionEffectJobIfNeeded(row: any) {
  if (!row || row.status === "expired") return row;
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (!expiresAt || expiresAt > Date.now()) return row;
  const paths = [row.input_storage_path, row.output_storage_path].filter(Boolean);
  if (paths.length) {
    await db.storage.from(MOTION_EFFECTS_BUCKET).remove(paths).catch(() => null);
  }
  const { data } = await db
    .from("tool_video_render_jobs")
    .update({ status: "expired", progress: 100 })
    .eq("id", row.id)
    .select("*")
    .maybeSingle();
  return data || { ...row, status: "expired", progress: 100 };
}

export async function failStaleMotionEffectJobsForUser(userId: string) {
  const staleBefore = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data } = await db
    .from("tool_video_render_jobs")
    .update({
      status: "failed",
      progress: 100,
      error_message: "任务长时间没有进展，已自动释放名额，请重新上传",
      completed_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .in("status", ["queued", "processing"])
    .lt("updated_at", staleBefore)
    .select("id");
  return data?.length || 0;
}

export async function failStaleMotionEffectJobIfNeeded(row: any) {
  if (!row || !["queued", "processing"].includes(row.status)) return row;
  const threshold = row.status === "queued" ? 15 : 60;
  const anchor = new Date(row.updated_at || row.enqueued_at || row.created_at).getTime();
  if (Date.now() - anchor <= threshold * 60 * 1000) return row;
  const { data } = await db
    .from("tool_video_render_jobs")
    .update({
      status: "failed",
      progress: 100,
      error_message: "任务长时间没有进展，请重新上传",
      completed_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .in("status", ["queued", "processing"])
    .select("*")
    .maybeSingle();
  return data || row;
}
