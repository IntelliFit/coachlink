import { NextResponse } from "next/server";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30); // 默认查询近 30 天

        const { data, error } = await serviceRoleSupabase
            .rpc("get_retention_data" as any, {
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
            });

        // --- DEBUG START ---
        try {
            const { count: behaviorCount } = await serviceRoleSupabase
                .from("user_behavior_events" as any)
                .select("*", { count: "exact", head: true });

            const { count: traceCount } = await serviceRoleSupabase
                .from("admin_trace_events")
                .select("*", { count: "exact", head: true });

            // Check recent events
            const { data: recentEvents } = await serviceRoleSupabase
                .from("user_behavior_events" as any)
                .select("created_at, event_name, user_id")
                .order("created_at", { ascending: false })
                .limit(5);

            const debugInfo = {
                timestamp: new Date().toISOString(),
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
                rpc_data: data,
                rpc_error: error,
                table_counts: {
                    user_behavior_events: behaviorCount,
                    admin_trace_events: traceCount,
                },
                recent_events: recentEvents,
            };

            const debugPath = path.join(process.cwd(), "debug_data.json");
            fs.writeFileSync(debugPath, JSON.stringify(debugInfo, null, 2));
        } catch (logErr) {
            console.error("Debug log failed", logErr);
        }
        // --- DEBUG END ---

        if (error) {
            console.error("Retention RPC error:", error);
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: error.message,
            }, { status: 500 });
        }

        // Format data to percentages for frontend
        const formattedData = (data as any[]).map((row) => {
            const formatPercent = (count: number, total: number) => {
                if (!total || total === 0) return "-";
                // if (!count) return "0%"; // active but 0 retained
                // 如果是今天刚注册的用户，次日留存还没发生，应该显示 '-' 还是 '0%'?
                // 简单起见，如果日期还没到，数据库查出来是 0。
                // 严谨点应该判断日期是否已过。但这里简化处理。
                const pct = Math.round((count / total) * 100);
                return `${pct}%`;
            };

            // 优化：如果是最近的时间，某些留存数据必然是 0（因为时间还没到），展示为 "-" 可能更好
            // 但数据库返回的是 count。
            // 我们可以在这里简单判断一下：如果 diff days < N，则为 -
            const cohortDate = new Date(row.date);
            const now = new Date();
            // 忽略时分秒差异，只看日期差
            const diffTime = now.setHours(0, 0, 0, 0) -
                cohortDate.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            return {
                date: row.date,
                newUsers: row.new_users,
                d1: diffDays >= 1
                    ? formatPercent(row.d1_count, row.new_users)
                    : "-",
                d3: diffDays >= 3
                    ? formatPercent(row.d3_count, row.new_users)
                    : "-",
                d7: diffDays >= 7
                    ? formatPercent(row.d7_count, row.new_users)
                    : "-",
                d30: diffDays >= 30
                    ? formatPercent(row.d30_count, row.new_users)
                    : "-",
            };
        });

        return NextResponse.json<ApiData<any>>({
            success: true,
            data: formattedData,
        });
    } catch (err) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "Server error",
        }, { status: 500 });
    }
}
