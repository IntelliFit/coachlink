import {
    COACH_EXIT_CANDIDATE_STORAGE_KEY,
    COACH_EXIT_LAST_ASKED_STORAGE_KEY,
    shouldAskCoachExitReason,
    type CoachExitCandidate,
    type CoachFunnelEvent,
} from "@coachlink/core/src/coachFunnel";

/** Web 端教练转化埋点。任何失败都静默，不能影响页面。 */

const ANON_ID_KEY = "coach_funnel_anon_id_v1";
const LIST_TRACKED_KEY = "coach_funnel_list_tracked_at_v1";
const LIST_TRACK_WINDOW_MS = 10 * 60 * 1000;
const RELEASE_HOSTS = new Set(["coachlink.fit", "www.coachlink.fit"]);

type FunnelPayload = {
    coachId?: string;
    reason?: string;
    note?: string;
    properties?: Record<string, string | number | undefined>;
};

function readStorage(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeStorage(key: string, value: string): void {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // 隐私模式等读写失败时最多少问一次
    }
}

function readAnonId(): string {
    const stored = readStorage(ANON_ID_KEY);
    if (stored) return stored;
    const created = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    writeStorage(ANON_ID_KEY, created);
    return created;
}

export function trackCoachFunnel(event: CoachFunnelEvent, payload: FunnelPayload = {}): void {
    if (typeof window === "undefined") return;
    fetch("/api/coach/funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // keepalive：离开页面时发出的事件也能送达
        keepalive: true,
        body: JSON.stringify({
            event,
            platform: "web",
            anonId: readAnonId(),
            coachId: payload.coachId,
            reason: payload.reason,
            note: payload.note,
            properties: {
                ...payload.properties,
                env: RELEASE_HOSTS.has(window.location.hostname) ? "release" : "dev",
            },
        }),
    }).catch(() => undefined);
}

/** 发现页来回切换不重复计数，10 分钟内算同一次浏览。 */
export function trackCoachListView(now: number = Date.now()): void {
    if (typeof window === "undefined") return;
    if (now - Number(readStorage(LIST_TRACKED_KEY) || 0) < LIST_TRACK_WINDOW_MS) return;
    writeStorage(LIST_TRACKED_KEY, String(now));
    trackCoachFunnel("list_view");
}

export function readCoachExitCandidate(): CoachExitCandidate | null {
    const raw = readStorage(COACH_EXIT_CANDIDATE_STORAGE_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as CoachExitCandidate;
    } catch {
        return null;
    }
}

export function rememberCoachExitCandidate(candidate: CoachExitCandidate): void {
    writeStorage(COACH_EXIT_CANDIDATE_STORAGE_KEY, JSON.stringify(candidate));
}

export function clearCoachExitCandidate(): void {
    try {
        window.localStorage.removeItem(COACH_EXIT_CANDIDATE_STORAGE_KEY);
    } catch {
        // 同上
    }
}

/** 取出这次该问的问题；取出即记为已问，同一次离开不会问两遍。 */
export function takeCoachExitQuestion(now: number = Date.now()): CoachExitCandidate | null {
    if (typeof window === "undefined") return null;
    const candidate = readCoachExitCandidate();
    if (!candidate) return null;
    clearCoachExitCandidate();
    const lastAskedAt = Number(readStorage(COACH_EXIT_LAST_ASKED_STORAGE_KEY)) || null;
    if (!shouldAskCoachExitReason({ candidate, now, lastAskedAt })) return null;
    writeStorage(COACH_EXIT_LAST_ASKED_STORAGE_KEY, String(now));
    return candidate;
}
