import { NextResponse, type NextRequest } from "next/server";
import { shouldSkipTrace } from "@/app/api/trace/trace-common";
import { getAuthUser } from "@/lib/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import {
    allowCoachFunnelEvent,
    isMissingTableError,
    toCoachFunnelEventRow,
} from "@/lib/coachFunnelEvents";

// X-Real-IP 由边缘 nginx 写入，客户端伪造不了；X-Forwarded-For 最左边那段是客户端可控的
function clientKey(req: NextRequest): string {
    return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * 教练转化埋点写入。公开接口，失败一律不打扰用户：
 * 本地不写（本地连的是正式库）；dev 站和体验版会写，但带 env 标记，不进报表；
 * 非法事件和超限请求直接丢弃。
 */
export async function POST(req: NextRequest) {
    if (shouldSkipTrace(req)) {
        return NextResponse.json({ success: true, message: "skip in non-prod", data: { ingested: 0 } });
    }
    if (!allowCoachFunnelEvent(clientKey(req))) {
        return NextResponse.json({ success: false, message: "too many events", data: null }, { status: 429 });
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ success: false, message: "invalid json", data: null }, { status: 400 });
    }

    const auth = await getAuthUser(req);
    const row = toCoachFunnelEventRow(body, auth.isAuthenticated && auth.userId ? auth.userId : null);
    if (!row) {
        return NextResponse.json({ success: false, message: "invalid event", data: null }, { status: 400 });
    }

    const { error } = await (serviceRoleSupabase.from("coach_funnel_events" as any) as any).insert(row);
    if (error) {
        // 外键失败（23503）是伪造或已删除的教练 id，不算服务端问题
        if (!isMissingTableError(error) && error.code !== "23503") {
            console.error("[coach-funnel] insert failed:", error);
        }
        return NextResponse.json({ success: true, message: "not stored", data: { ingested: 0 } });
    }

    return NextResponse.json({ success: true, message: "ok", data: { ingested: 1 } });
}
