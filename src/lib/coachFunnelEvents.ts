import {
    COACH_EXIT_NOTE_MAX_LENGTH,
    COACH_FUNNEL_PLATFORMS,
    isCoachExitReason,
    isCoachFunnelEvent,
    type CoachFunnelEvent,
    type CoachFunnelPlatform,
} from "@coachlink/core/src/coachFunnel";

/** 接口公开（未登录访客也要统计），所以字段全部白名单校验，身份只取自登录态。 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ANON_ID_LENGTH = 64;
const MAX_PROPERTY_TEXT_LENGTH = 64;
const ALLOWED_PROPERTY_KEYS = ["viewer", "blocked", "product_id", "months", "price", "trigger", "message", "env"] as const;

export type CoachFunnelEventRow = {
    event: CoachFunnelEvent;
    coach_id: string | null;
    user_id: string | null;
    anon_id: string | null;
    platform: CoachFunnelPlatform;
    reason: string | null;
    note: string | null;
    properties: Record<string, string | number>;
};

function cleanProperties(input: unknown): Record<string, string | number> {
    if (!input || typeof input !== "object" || Array.isArray(input)) return {};
    const source = input as Record<string, unknown>;
    const clean: Record<string, string | number> = {};
    for (const key of ALLOWED_PROPERTY_KEYS) {
        const value = source[key];
        if (typeof value === "number" && Number.isFinite(value)) clean[key] = value;
        if (typeof value === "string" && value) clean[key] = value.slice(0, MAX_PROPERTY_TEXT_LENGTH);
    }
    return clean;
}

/** 不合法的事件返回 null，直接丢弃。 */
export function toCoachFunnelEventRow(body: unknown, userId: string | null): CoachFunnelEventRow | null {
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const input = body as Record<string, unknown>;

    if (!isCoachFunnelEvent(input.event)) return null;
    if (!(COACH_FUNNEL_PLATFORMS as readonly unknown[]).includes(input.platform)) return null;

    const coachId = typeof input.coachId === "string" && UUID_PATTERN.test(input.coachId) ? input.coachId : null;
    if (input.event !== "list_view" && !coachId) return null;

    const anonId = typeof input.anonId === "string" && input.anonId ? input.anonId.slice(0, MAX_ANON_ID_LENGTH) : null;
    if (!userId && !anonId) return null;

    let reason: string | null = null;
    let note: string | null = null;
    if (input.event === "exit_reason") {
        if (!isCoachExitReason(input.reason)) return null;
        reason = input.reason;
        const text = typeof input.note === "string" ? input.note.trim() : "";
        note = text ? text.slice(0, COACH_EXIT_NOTE_MAX_LENGTH) : null;
    }

    return {
        event: input.event,
        coach_id: coachId,
        user_id: userId,
        anon_id: anonId,
        platform: input.platform as CoachFunnelPlatform,
        reason,
        note,
        properties: cleanProperties(input.properties),
    };
}

const RATE_WINDOW_MS = 60 * 1000;
// 放宽到足够大：万一代理层把多个用户合并成同一个 IP，也不至于丢正常事件
export const COACH_FUNNEL_RATE_LIMIT_PER_MINUTE = 300;
const MAX_TRACKED_KEYS = 5000;
const rateBuckets = new Map<string, { windowStart: number; count: number }>();

/** 单 Pod 内存限流，只防刷库，正常用户一分钟到不了这么多事件。 */
export function allowCoachFunnelEvent(key: string, now: number = Date.now()): boolean {
    const bucket = rateBuckets.get(key);
    if (!bucket || now - bucket.windowStart >= RATE_WINDOW_MS) {
        if (rateBuckets.size >= MAX_TRACKED_KEYS) rateBuckets.clear();
        rateBuckets.set(key, { windowStart: now, count: 1 });
        return true;
    }
    bucket.count += 1;
    return bucket.count <= COACH_FUNNEL_RATE_LIMIT_PER_MINUTE;
}

export function resetCoachFunnelRateLimit(): void {
    rateBuckets.clear();
}

/** 迁移还没执行时表不存在，埋点静默跳过，不影响页面。 */
export function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
    if (!error) return false;
    return error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message || "");
}
