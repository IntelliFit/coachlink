"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

interface TraceEventPayload {
    event_type: string;
    path: string | null;
    url: string | null;
    referrer: string | null;
    anon_id: string | null;
    session_id: string | null;
    properties?: Record<string, unknown>;
    trace_id?: string;
    method?: string;
}

const ANON_KEY = "trace_anon_id";
const SESSION_KEY = "trace_session_id";

function getAnonId(): string {
    try {
        const stored = localStorage.getItem(ANON_KEY);
        if (stored) return stored;
        const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        localStorage.setItem(ANON_KEY, id);
        return id;
    } catch (_err) {
        return "anon";
    }
}

function getSessionId(): string {
    try {
        const stored = sessionStorage.getItem(SESSION_KEY);
        if (stored) return stored;
        const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        sessionStorage.setItem(SESSION_KEY, id);
        return id;
    } catch (_err) {
        return "session";
    }
}

async function sendEnter(payload: TraceEventPayload) {
    try {
        await fetch("/api/trace", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ events: [payload] }),
            keepalive: true,
        });
    } catch (_err) {
        // swallow client errors
    }
}

async function sendLeave(traceId: string, durationMs: number) {
    try {
        await fetch("/api/trace", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                trace_id: traceId,
                leave_at: new Date().toISOString(),
                duration_ms: Math.round(durationMs),
            }),
            keepalive: true,
        });
    } catch (_err) {
        // swallow client errors
    }
}

export default function TraceReporter() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const lastPathRef = useRef<string | null>(null);
    const startRef = useRef<number | null>(null);
    const traceIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!pathname) return;

        const currentKey = searchParams?.toString()
            ? `${pathname}?${searchParams.toString()}`
            : pathname;

        const now = performance.now();
        const prevPath = lastPathRef.current;
        const prevStart = startRef.current ?? now;
        const prevTraceId = traceIdRef.current;

        // 先上报离开上一页
        if (prevPath && prevTraceId) {
            const durationMs = Math.max(0, now - prevStart);
            void sendLeave(prevTraceId, durationMs);
        }

        // 为当前页生成新的 trace_id 并上报进入
        const newTraceId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        traceIdRef.current = newTraceId;

        void sendEnter({
            event_type: "page_enter",
            path: currentKey,
            url: typeof window !== "undefined" ? window.location.href : null,
            referrer: typeof document !== "undefined" ? document.referrer || null : null,
            anon_id: getAnonId(),
            session_id: getSessionId(),
            trace_id: newTraceId,
            method: "GET",
            properties: {
                from_path: prevPath,
                to_path: currentKey,
            },
        });

        lastPathRef.current = currentKey;
        startRef.current = performance.now();
    }, [pathname, searchParams]);

    useEffect(() => {
        const handler = () => {
            const prevTraceId = traceIdRef.current;
            const prevStart = startRef.current ?? performance.now();
            if (prevTraceId) {
                const durationMs = Math.max(0, performance.now() - prevStart);
                void sendLeave(prevTraceId, durationMs);
            }
        };
        window.addEventListener("pagehide", handler);
        window.addEventListener("beforeunload", handler);
        return () => {
            window.removeEventListener("pagehide", handler);
            window.removeEventListener("beforeunload", handler);
        };
    }, []);

    return null;
}
