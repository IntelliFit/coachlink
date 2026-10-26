/**
 * Power-analysis job lifecycle shared by the Web API, the worker and both clients.
 * A user may have one active (queued or processing) job at a time; they can cancel it
 * while it is still waiting for its upload, queued or being analyzed.
 */

export type PowerAnalysisJobStatus =
  | "awaiting_upload"
  | "queued"
  | "processing"
  | "done"
  | "failed"
  | "expired"
  | "canceled";

export const POWER_ANALYSIS_ACTIVE_JOB_STATUSES: readonly PowerAnalysisJobStatus[] = ["queued", "processing"];

export const POWER_ANALYSIS_CANCELABLE_JOB_STATUSES: readonly PowerAnalysisJobStatus[] = [
  "awaiting_upload",
  "queued",
  "processing",
];

export const POWER_ANALYSIS_TERMINAL_JOB_STATUSES: readonly PowerAnalysisJobStatus[] = [
  "done",
  "failed",
  "expired",
  "canceled",
];

/** API `code` returned with HTTP 409 when the user already has a queued or processing job. */
export const POWER_ANALYSIS_ACTIVE_JOB_CONFLICT_CODE = "POWER_ANALYSIS_ACTIVE_JOB";

export const POWER_ANALYSIS_ACTIVE_JOB_CONFLICT_MESSAGE = "上一个视频还在分析，可以查看进度，或取消后再提交新视频";

export const POWER_ANALYSIS_CANCELED_MESSAGE = "已取消分析";

export function isActivePowerAnalysisJobStatus(status: unknown): boolean {
  return POWER_ANALYSIS_ACTIVE_JOB_STATUSES.includes(status as PowerAnalysisJobStatus);
}

export function isTerminalPowerAnalysisJobStatus(status: unknown): boolean {
  return POWER_ANALYSIS_TERMINAL_JOB_STATUSES.includes(status as PowerAnalysisJobStatus);
}

export type PowerAnalysisCancelDecision =
  | { action: "cancel" }
  | { action: "already_canceled" }
  | { action: "reject"; message: string };

/** What a cancel request should do for a job in `status`. */
export function getPowerAnalysisCancelDecision(status: unknown): PowerAnalysisCancelDecision {
  if (POWER_ANALYSIS_CANCELABLE_JOB_STATUSES.includes(status as PowerAnalysisJobStatus)) {
    return { action: "cancel" };
  }
  if (status === "canceled") return { action: "already_canceled" };
  if (status === "done") return { action: "reject", message: "分析已经完成，无需取消" };
  if (status === "failed") return { action: "reject", message: "任务已经结束，无需取消" };
  if (status === "expired") return { action: "reject", message: "任务已过期，无需取消" };
  return { action: "reject", message: "任务状态异常，无法取消" };
}
