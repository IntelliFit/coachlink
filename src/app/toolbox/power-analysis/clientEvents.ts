/**
 * Tells the server why a job never reached the queue, so usage reviews can tell an
 * upload bug from a user who left. Same contract as the mini-program.
 */
export type PowerClientEventName = "upload_failed" | "left_during_upload" | "left_without_start";

export function reportPowerClientEvent(
  jobId: string | null | undefined,
  event: PowerClientEventName,
  details: { stage?: string; message?: string; progress?: number } = {},
) {
  if (!jobId) return;
  const url = `/api/toolbox/power-analysis/jobs/${jobId}/client-event`;
  const body = JSON.stringify({
    event,
    ...details,
    client: { platform: "web", userAgent: navigator.userAgent.slice(0, 120) },
  });
  // A leaving page cancels fetch; sendBeacon still delivers (same-origin, with cookies).
  if (event === "left_during_upload" && typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })
    .catch(() => undefined);
}
