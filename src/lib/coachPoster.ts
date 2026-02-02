import { serviceRoleSupabase } from "@/lib/supabaseClient";

export const COACH_POSTER_BUCKET = "coach-posters";
export const INVITATION_POSTER_TYPE = "invitation_hd";

export type CoachPosterStatus = "queued" | "generating" | "ready" | "failed";

type InMemoryJob = {
  coachId: string;
  posterType: string;
  requestedBy?: string;
  startedAtMs: number;
  lastHeartbeatMs: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __coachPosterJobs: Map<string, InMemoryJob> | undefined;
}

function getJobKey(coachId: string, posterType: string) {
  return `${coachId}:${posterType}`;
}

function getJobMap(): Map<string, InMemoryJob> {
  if (!globalThis.__coachPosterJobs) {
    globalThis.__coachPosterJobs = new Map();
  }
  return globalThis.__coachPosterJobs;
}

export function getInMemoryPosterJob(coachId: string, posterType: string) {
  return getJobMap().get(getJobKey(coachId, posterType)) || null;
}

function startInMemoryPosterJob(job: Omit<InMemoryJob, "lastHeartbeatMs">) {
  const now = Date.now();
  getJobMap().set(getJobKey(job.coachId, job.posterType), {
    ...job,
    lastHeartbeatMs: now,
  });
}

function heartbeatInMemoryPosterJob(coachId: string, posterType: string) {
  const key = getJobKey(coachId, posterType);
  const existing = getJobMap().get(key);
  if (!existing) return;
  existing.lastHeartbeatMs = Date.now();
  getJobMap().set(key, existing);
}

function finishInMemoryPosterJob(coachId: string, posterType: string) {
  getJobMap().delete(getJobKey(coachId, posterType));
}

const STUCK_GENERATING_MS = 2 * 60 * 1000; // 2 minutes

export interface CoachPosterRow {
  id: string;
  coach_id: string;
  poster_type: string;
  status: CoachPosterStatus;
  image_url: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  image_meta: any;
  requested_by: string | null;
  requested_at: string;
  generation_started_at: string | null;
  generation_finished_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

async function ensureBucketPublic(bucketId: string) {
  // Best-effort: the SQL migrations should create buckets/policies in prod.
  // This helps local/dev environments that didn't run migrations yet.
  const { data: buckets } = await serviceRoleSupabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.id === bucketId || b.name === bucketId);
  if (exists) return;

  await serviceRoleSupabase.storage.createBucket(bucketId, {
    public: true,
  });
}

export async function upsertCoachPosterQueued(params: {
  coachId: string;
  posterType?: string;
  requestedBy?: string;
}) {
  const posterType = params.posterType || INVITATION_POSTER_TYPE;
  const now = new Date().toISOString();

  const { data, error } = await serviceRoleSupabase
    .from("coach_posters")
    .upsert(
      {
        coach_id: params.coachId,
        poster_type: posterType,
        status: "queued",
        requested_by: params.requestedBy || null,
        requested_at: now,
        updated_at: now,
      } as any,
      { onConflict: "coach_id,poster_type" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as CoachPosterRow;
}

export async function tryAcquireCoachPosterJob(params: {
  coachId: string;
  posterType?: string;
  requestedBy?: string;
}) {
  const posterType = params.posterType || INVITATION_POSTER_TYPE;
  const now = new Date().toISOString();

  const { data, error } = await serviceRoleSupabase
    .from("coach_posters")
    .update({
      status: "generating",
      generation_started_at: now,
      generation_finished_at: null,
      last_error: null,
      requested_by: params.requestedBy || null,
      requested_at: now,
      updated_at: now,
    } as any)
    .eq("coach_id", params.coachId)
    .eq("poster_type", posterType)
    .in("status", ["queued", "failed"])
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (data) {
    startInMemoryPosterJob({
      coachId: params.coachId,
      posterType,
      requestedBy: params.requestedBy,
      startedAtMs: Date.now(),
    });
  }
  return (data as CoachPosterRow | null) || null;
}

export async function recoverIfStuckGenerating(params: {
  coachId: string;
  posterType?: string;
}) {
  const posterType = params.posterType || INVITATION_POSTER_TYPE;
  const job = getJobMap().get(getJobKey(params.coachId, posterType));
  if (job) return false; // still running in this process

  const { data: row, error } = await serviceRoleSupabase
    .from("coach_posters")
    .select("status,generation_started_at,updated_at")
    .eq("coach_id", params.coachId)
    .eq("poster_type", posterType)
    .maybeSingle();
  if (error || !row) return false;
  if (row.status !== "generating") return false;

  const startedAtMs = row.generation_started_at
    ? Date.parse(row.generation_started_at)
    : Date.parse(row.updated_at);
  if (!Number.isFinite(startedAtMs)) return false;

  const ageMs = Date.now() - startedAtMs;
  if (ageMs < STUCK_GENERATING_MS) return false;

  await markPosterFailed({
    coachId: params.coachId,
    posterType,
    errorMessage:
      "生成任务可能已中断（超时自动回滚）。请点击“更新海报”重试。",
  });
  return true;
}

export async function generateInvitationPosterInBackground(params: {
  coachId: string;
  requestedBy?: string;
  origin: string;
  cookieHeader?: string;
}) {
  // Fire-and-forget wrapper: the caller should NOT await this.
  void generateInvitationPoster({
    coachId: params.coachId,
    requestedBy: params.requestedBy,
    origin: params.origin,
    cookieHeader: params.cookieHeader,
  }).catch(async (e) => {
    console.error("[coach-poster] background generation failed:", e);
    await markPosterFailed({
      coachId: params.coachId,
      posterType: INVITATION_POSTER_TYPE,
      errorMessage: e?.message || String(e),
    }).catch((err) => {
      console.error("[coach-poster] mark failed error:", err);
    });
    finishInMemoryPosterJob(params.coachId, INVITATION_POSTER_TYPE);
  });
}

export async function generateInvitationPoster(params: {
  coachId: string;
  requestedBy?: string;
  origin: string;
  cookieHeader?: string;
}) {
  heartbeatInMemoryPosterJob(params.coachId, INVITATION_POSTER_TYPE);
  // 1) Call existing OG endpoint to render poster PNG
  const internalKey = process.env.INTERNAL_POSTER_KEY;
  const extraHeaders: Record<string, string> = {};
  if (internalKey) {
    extraHeaders["x-internal-poster-key"] = internalKey;
  } else if (params.cookieHeader) {
    // Fallback when INTERNAL_POSTER_KEY is not configured (dev convenience):
    // reuse the caller's session cookie so middleware auth passes.
    extraHeaders["cookie"] = params.cookieHeader;
  }

  const ogResp = await fetch(`${params.origin}/api/og/invitation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify({ coachId: params.coachId }),
    cache: "no-store",
  });

  if (!ogResp.ok) {
    const text = await ogResp.text().catch(() => "");
    throw new Error(
      `OG render failed: ${ogResp.status} ${ogResp.statusText} ${text}`.slice(
        0,
        500,
      ),
    );
  }

  const contentType =
    ogResp.headers.get("content-type") || "application/octet-stream";
  const arrayBuffer = await ogResp.arrayBuffer();
  const bytes = arrayBuffer.byteLength;
  const uint8 = new Uint8Array(arrayBuffer);
  heartbeatInMemoryPosterJob(params.coachId, INVITATION_POSTER_TYPE);

  // 2) Upload to Storage
  await ensureBucketPublic(COACH_POSTER_BUCKET);
  heartbeatInMemoryPosterJob(params.coachId, INVITATION_POSTER_TYPE);

  const storagePath = `${params.coachId}/${INVITATION_POSTER_TYPE}.png`;
  
  // Upload new file (upsert will overwrite if exists)
  console.log(`[coach-poster] Uploading poster to ${storagePath} for coach ${params.coachId}`);
  const { error: uploadError } = await serviceRoleSupabase.storage
    .from(COACH_POSTER_BUCKET)
    .upload(storagePath, uint8, {
      contentType: "image/png",
      upsert: true, // Ensure overwrite if file exists
      cacheControl: "0", // No cache to ensure fresh image
    });

  if (uploadError) {
    console.error(`[coach-poster] Upload failed for coach ${params.coachId}:`, uploadError);
    throw uploadError;
  }
  
  console.log(`[coach-poster] Successfully uploaded poster to ${storagePath} for coach ${params.coachId}`);
  
  heartbeatInMemoryPosterJob(params.coachId, INVITATION_POSTER_TYPE);

  const {
    data: { publicUrl },
  } = serviceRoleSupabase.storage
    .from(COACH_POSTER_BUCKET)
    .getPublicUrl(storagePath);

  // 3) Persist status + metadata
  const now = new Date().toISOString();
  const meta = {
    contentType,
    bytes,
    storage: {
      bucket: COACH_POSTER_BUCKET,
      path: storagePath,
    },
    source: {
      type: "next_og",
      endpoint: "/api/og/invitation",
    },
    generatedAt: now,
  };

  console.log(`[coach-poster] Updating database for coach ${params.coachId}, image_url: ${publicUrl}`);
  
  const { data: updated, error: updateErr } = await serviceRoleSupabase
    .from("coach_posters")
    .update({
      status: "ready",
      image_url: publicUrl,
      storage_bucket: COACH_POSTER_BUCKET,
      storage_path: storagePath,
      image_meta: meta,
      generation_finished_at: now,
      updated_at: now,
      last_error: null,
      requested_by: params.requestedBy || null,
    } as any)
    .eq("coach_id", params.coachId)
    .eq("poster_type", INVITATION_POSTER_TYPE)
    .select("*")
    .single();

  if (updateErr) {
    console.error(`[coach-poster] Database update failed for coach ${params.coachId}:`, updateErr);
    throw updateErr;
  }
  
  if (!updated) {
    console.error(`[coach-poster] Database update returned no data for coach ${params.coachId}`);
    throw new Error("Database update returned no data");
  }
  
  console.log(`[coach-poster] Successfully updated database for coach ${params.coachId}, updated_at: ${updated.updated_at}, image_url: ${updated.image_url}`);
  finishInMemoryPosterJob(params.coachId, INVITATION_POSTER_TYPE);
  return updated as CoachPosterRow;
}

export async function markPosterFailed(params: {
  coachId: string;
  posterType?: string;
  errorMessage: string;
}) {
  const posterType = params.posterType || INVITATION_POSTER_TYPE;
  const now = new Date().toISOString();
  await serviceRoleSupabase
    .from("coach_posters")
    .update({
      status: "failed",
      last_error: params.errorMessage.slice(0, 800),
      generation_finished_at: now,
      updated_at: now,
    } as any)
    .eq("coach_id", params.coachId)
    .eq("poster_type", posterType);
  finishInMemoryPosterJob(params.coachId, posterType);
}

