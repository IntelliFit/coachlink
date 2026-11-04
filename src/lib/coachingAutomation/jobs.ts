import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { AutomationJobRow, AutomationJobStatus, AutomationJobType } from "./types";

type CreateJobInput = {
  type: AutomationJobType;
  triggerSource: string;
  idempotencyKey: string;
  subscriptionId?: string | null;
  coachId?: string | null;
  studentId?: string | null;
  planInstanceId?: string | null;
  feedbackId?: string | null;
  inputSnapshot?: Record<string, unknown> | null;
  needsCoachConfirmation?: boolean;
};

function table() {
  return (serviceRoleSupabase as any).from("coach_automation_jobs");
}

export async function createAutomationJob(input: CreateJobInput): Promise<AutomationJobRow> {
  const now = new Date().toISOString();
  const payload = {
    type: input.type,
    trigger_source: input.triggerSource,
    idempotency_key: input.idempotencyKey,
    subscription_id: input.subscriptionId || null,
    coach_id: input.coachId || null,
    student_id: input.studentId || null,
    plan_instance_id: input.planInstanceId || null,
    feedback_id: input.feedbackId || null,
    input_snapshot: input.inputSnapshot || null,
    needs_coach_confirmation: Boolean(input.needsCoachConfirmation),
    updated_at: now,
  };

  const { data, error } = await table()
    .upsert(payload, { onConflict: "idempotency_key", ignoreDuplicates: true })
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (data) return data as AutomationJobRow;

  const { data: existing, error: readError } = await table()
    .select("*")
    .eq("idempotency_key", input.idempotencyKey)
    .single();
  if (readError) throw readError;
  return existing as AutomationJobRow;
}

export function isTerminalJob(job: AutomationJobRow | null | undefined) {
  return job?.status === "succeeded" || job?.status === "skipped" || job?.status === "needs_coach_review";
}

/** A running job older than this is treated as orphaned (pod restarted mid-run) and may be claimed again. */
export const STALE_RUNNING_JOB_MS = 15 * 60 * 1000;

export function isStaleRunningJob(job: AutomationJobRow, nowMs = Date.now()) {
  if (job.status !== "running") return false;
  const startedMs = Date.parse(String(job.started_at || job.updated_at || ""));
  return !Number.isFinite(startedMs) || nowMs - startedMs > STALE_RUNNING_JOB_MS;
}

/**
 * Moves a job to running only if nobody else changed it since it was read.
 * Two triggers for one subscription (payment callback + polling, coach retry)
 * both get the same row from createAutomationJob; only one wins this update.
 */
export async function claimAutomationJob(
  job: AutomationJobRow,
  claimableStatuses: AutomationJobStatus[],
): Promise<boolean> {
  const claimable = claimableStatuses.includes(job.status) || isStaleRunningJob(job);
  if (!claimable) return false;

  const now = new Date().toISOString();
  let query = table()
    .update({ status: "running", started_at: now, updated_at: now, finished_at: null, error_message: null })
    .eq("id", job.id)
    .eq("status", job.status);
  query = job.updated_at ? query.eq("updated_at", job.updated_at) : query.is("updated_at", null);
  const { data, error } = await query.select("id");
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

export async function markAutomationJob(
  jobId: string,
  status: AutomationJobStatus,
  values: {
    outputSnapshot?: Record<string, unknown> | null;
    errorMessage?: string | null;
    planInstanceId?: string | null;
    needsCoachConfirmation?: boolean;
  } = {},
) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status,
    updated_at: now,
  };
  if (status === "running") patch.started_at = now;
  if (["succeeded", "failed", "needs_coach_review", "skipped"].includes(status)) patch.finished_at = now;
  if (values.outputSnapshot !== undefined) patch.output_snapshot = values.outputSnapshot;
  if (values.errorMessage !== undefined) patch.error_message = values.errorMessage;
  if (values.planInstanceId !== undefined) patch.plan_instance_id = values.planInstanceId;
  if (values.needsCoachConfirmation !== undefined) {
    patch.needs_coach_confirmation = values.needsCoachConfirmation;
  }

  const { error } = await table().update(patch).eq("id", jobId);
  if (error) throw error;
}
