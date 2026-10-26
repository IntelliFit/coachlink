/**
 * Client-side reasons a power-analysis job never reached the queue. The server sees
 * nothing when an upload dies before the first byte or the user walks away, so the
 * client reports it once and it is kept on the job's metadata for usage reviews.
 */
export const POWER_ANALYSIS_CLIENT_EVENTS = [
  "upload_failed",
  "left_during_upload",
  "left_without_start",
] as const;

export type PowerAnalysisClientEventName = (typeof POWER_ANALYSIS_CLIENT_EVENTS)[number];

export interface PowerAnalysisClientEvent {
  event: PowerAnalysisClientEventName;
  stage: string | null;
  message: string | null;
  progress: number | null;
  client: Record<string, string>;
  at: string;
}

const MAX_TEXT = 300;
const MAX_EVENTS_PER_JOB = 5;
const CLIENT_FIELDS = ["platform", "brand", "model", "system", "wechatVersion", "sdkVersion", "userAgent"] as const;

function text(value: unknown, max = MAX_TEXT): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

export function parsePowerAnalysisClientEvent(body: unknown, now = new Date()): PowerAnalysisClientEvent | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const raw = body as Record<string, unknown>;
  if (!POWER_ANALYSIS_CLIENT_EVENTS.includes(raw.event as PowerAnalysisClientEventName)) return null;
  const rawClient = raw.client && typeof raw.client === "object" ? (raw.client as Record<string, unknown>) : {};
  const client: Record<string, string> = {};
  for (const field of CLIENT_FIELDS) {
    const value = text(rawClient[field], 120);
    if (value) client[field] = value;
  }
  const progress = Number(raw.progress);
  return {
    event: raw.event as PowerAnalysisClientEventName,
    stage: text(raw.stage, 60),
    message: text(raw.message),
    progress: Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress))) : null,
    client,
    at: now.toISOString(),
  };
}

/** New metadata with the event appended; older events beyond the cap are dropped. */
export function appendPowerAnalysisClientEvent(
  metadata: Record<string, unknown>,
  event: PowerAnalysisClientEvent,
): Record<string, unknown> {
  const previous = Array.isArray(metadata.client_events) ? metadata.client_events : [];
  return { ...metadata, client_events: [...previous, event].slice(-MAX_EVENTS_PER_JOB) };
}
