import { NextResponse } from "next/server";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "7d"; // 7d, 30d
    
    let days = 7;
    if (range === "30d") days = 30;
    if (range === "90d") days = 90;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Query materialized view feature_usage_stats
    const { data, error } = await serviceRoleSupabase
        .from("feature_usage_stats" as any)
        .select("*")
        .gte("date", startDate.toISOString())
        .order("usage_count", { ascending: false });

    if (error) {
        return NextResponse.json<ApiData<null>>({ success: false, message: error.message }, { status: 500 });
    }

    // Process data for charts
    // Group by event_name, sum usage_count
    const summary: Record<string, number> = {};
    data?.forEach((row: any) => {
        summary[row.event_name] = (summary[row.event_name] || 0) + row.usage_count;
    });

    const topFeatures = Object.entries(summary)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    return NextResponse.json<ApiData<any>>({
        success: true,
        data: {
            raw: data,
            topFeatures
        }
    });
}
