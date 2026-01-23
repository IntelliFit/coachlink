import { NextResponse } from "next/server";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { hasServiceRoleKey } from "@/app/api/trace/trace-common";
import type { ApiData } from "@/types/api";
import type { Database } from "@/types/database.types";

// Extended type to cover new columns not yet in generated types
type TraceRow = Database["public"]["Tables"]["admin_trace_events"]["Row"] & {
     from_path?: string | null;
     duration_ms?: number | null;
 };

type Totals = {
    page_views: number;
    unique_sessions: number;
    avg_duration_ms: number | null;
};

type DailyRow = {
    date: string;
    page_views: number;
    avg_duration_ms: number | null;
};

type GroupRow = {
    path?: string | null;
    referrer?: string | null;
    from_path?: string | null;
    count: number;
    avg_duration_ms?: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDayUTC(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

function parseDateParam(value: string | null, fallback: Date): Date {
    if (!value) return fallback;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return fallback;
    return parsed;
}

export async function GET(req: Request) {
    if (!hasServiceRoleKey()) {
        return NextResponse.json<ApiData<null>>({ success: false, message: "缺少 service role key" }, { status: 500 });
    }

    // 即便埋点关闭，也允许查询；仅写入受 shouldSkipTrace 控制
    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    const includeDev = searchParams.get("includeDev") === "1";
    const includeAdmin = searchParams.get("includeAdmin") === "1";

    const now = startOfDayUTC(new Date());
    const defaultStart = startOfDayUTC(new Date(now.getTime() - 6 * DAY_MS)); // 默认近 7 天

    const startDate = startOfDayUTC(parseDateParam(startParam, defaultStart));
    const endDate = startOfDayUTC(parseDateParam(endParam, now));

    const startISO = new Date(startDate).toISOString();
    const endExclusiveISO = new Date(endDate.getTime() + DAY_MS).toISOString();

    const trackedEventTypes = ["page_view", "page_enter"];

    let query = serviceRoleSupabase
        .from("admin_trace_events")
        .select("path,from_path,referrer,session_id,anon_id,created_at,duration_ms", { count: "exact" })
        .in("event_type", trackedEventTypes)
        .gte("created_at", startISO)
        .lt("created_at", endExclusiveISO);

    if (!includeDev) {
        query = query.neq("env", "development");
    }

    if (!includeAdmin) {
        query = query.or("path.is.null,path.not.ilike./admin/%");
    }

    const { data: eventsRaw, error, count } = await query;

    if (error) {
        console.error("trace analytics query error", error);
        return NextResponse.json<ApiData<null>>({ success: false, message: "查询失败" }, { status: 500 });
    }

    const events = ((eventsRaw ?? []) as unknown) as TraceRow[];

    const uniqueSessionSet = new Set<string>();
    let durationSum = 0;
    let durationCount = 0;
    for (const ev of events) {
        const sessionKey = ev.session_id || ev.anon_id;
        if (sessionKey) uniqueSessionSet.add(sessionKey);
        if (typeof ev.duration_ms === "number") {
            durationSum += ev.duration_ms;
            durationCount += 1;
        }
    }

    const totals: Totals = {
        page_views: count ?? events.length,
        unique_sessions: uniqueSessionSet.size,
        avg_duration_ms: durationCount ? durationSum / durationCount : null,
    };

    const dailyMap = new Map<string, { page_views: number; durationSum: number; durationCount: number }>();
    const pathMap = new Map<string | null, { count: number; durationSum: number; durationCount: number }>();
    const referrerMap = new Map<string | null, { count: number }>();
    const fromPathMap = new Map<string | null, { count: number }>();

    for (const ev of events) {
        const day = ev.created_at?.slice(0, 10) ?? "";
        if (day) {
            const entry = dailyMap.get(day) || { page_views: 0, durationSum: 0, durationCount: 0 };
            entry.page_views += 1;
            if (typeof ev.duration_ms === "number") {
                entry.durationSum += ev.duration_ms;
                entry.durationCount += 1;
            }
            dailyMap.set(day, entry);
        }

        const pathKey = ev.path ?? null;
        const pathEntry = pathMap.get(pathKey) || { count: 0, durationSum: 0, durationCount: 0 };
        pathEntry.count += 1;
        if (typeof ev.duration_ms === "number") {
            pathEntry.durationSum += ev.duration_ms;
            pathEntry.durationCount += 1;
        }
        pathMap.set(pathKey, pathEntry);

        const refKey = ev.referrer ?? null;
        referrerMap.set(refKey, { count: (referrerMap.get(refKey)?.count ?? 0) + 1 });

        const fromKey = ev.from_path && ev.from_path.trim().length > 0 ? ev.from_path : "直接访问/未知来源";
        fromPathMap.set(fromKey, { count: (fromPathMap.get(fromKey)?.count ?? 0) + 1 });
    }

    const daily: DailyRow[] = Array.from(dailyMap.entries())
        .map(([date, v]) => ({
            date,
            page_views: v.page_views,
            avg_duration_ms: v.durationCount ? v.durationSum / v.durationCount : null,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

    const top_paths: GroupRow[] = Array.from(pathMap.entries())
        .map(([path, v]) => ({
            path,
            count: v.count,
            avg_duration_ms: v.durationCount ? v.durationSum / v.durationCount : null,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

    const top_referrers: GroupRow[] = Array.from(referrerMap.entries())
        .map(([referrer, v]) => ({ referrer, count: v.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

    const top_from_paths: GroupRow[] = Array.from(fromPathMap.entries())
        .map(([from_path, v]) => ({ from_path, count: v.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

    return NextResponse.json<ApiData<any>>({
        success: true,
        message: "ok",
        data: {
            totals,
            daily,
            top_paths,
            top_referrers,
            top_from_paths,
        },
    });
}
