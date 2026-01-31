import type { NextRequest } from "next/server";
import {
    MAX_TEXT_LENGTH,
    API_TRACE_ENABLED,
    TRACE_ENV,
    hasServiceRoleKey,
    safeText,
    shouldSkipTrace,
} from "@/app/api/trace/trace-common";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { Database } from "@/types/database.types";

export const matcher = ["/api/:path*"];

export async function handle(req: NextRequest) {
    if (!API_TRACE_ENABLED) return;

    if (!hasServiceRoleKey()) return;

    if (shouldSkipTrace(req)) return;

    const path = safeText(req.nextUrl.pathname, MAX_TEXT_LENGTH);
    const url = safeText(req.nextUrl.href, MAX_TEXT_LENGTH);
    const referrer = safeText(req.headers.get("referer"), MAX_TEXT_LENGTH);
    const userAgent = safeText(req.headers.get("user-agent"), MAX_TEXT_LENGTH);

    const event: Database["public"]["Tables"]["admin_trace_events"]["Insert"] = {
        event_type: "api_hit",
        path,
        url,
        referrer,
        user_agent: userAgent,
        anon_id: null,
        session_id: null,
        user_id: null,
        created_at: new Date().toISOString(),
        env: TRACE_ENV,
        method: req.method,
    };

    // Fire-and-forget，不阻塞主请求
    void (async () => {
        try {
            await serviceRoleSupabase.from("admin_trace_events").insert([event]);
        } catch (_err) {
            // swallow errors
        }
    })();
}
