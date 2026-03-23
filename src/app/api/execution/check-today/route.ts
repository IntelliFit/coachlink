import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    CheckTodayDto,
    CheckTodayResponseDto,
} from "./entity";
import { validateExecutionSubscriptionAccess } from "../_helpers/subscriptionAccess";

/**
 * POST /api/execution/check-today
 *
 * 检查今天是否有执行记录
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<CheckTodayResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }

        const userId = session.user.id;
        const body = await req.json() as CheckTodayDto;
        const { instanceId, dayIndex = 1 } = body;

        if (!instanceId) {
            return NextResponse.json<ApiData<CheckTodayResponseDto>>({
                success: false,
                message: "缺少参数",
                data: null,
            }, { status: 400 });
        }

        const accessDecision = await validateExecutionSubscriptionAccess({
            instanceId,
            studentId: userId,
            dayIndex,
        });
        if (!accessDecision.allowed) {
            return NextResponse.json<ApiData<CheckTodayResponseDto>>({
                success: false,
                message: accessDecision.message || "无权访问此计划",
                data: null,
            }, { status: accessDecision.status });
        }

        // 查询“今天”的执行记录（按 Asia/Shanghai 日界线；避免 UTC toISOString 导致差一天）
        const tz = "Asia/Shanghai";
        const now = new Date();
        const dateKey = new Intl.DateTimeFormat("en-CA", {
            timeZone: tz,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(now); // YYYY-MM-DD
        const [y, m, d] = dateKey.split("-").map((v) => Number(v));
        // Asia/Shanghai is UTC+8 (no DST). Start of local day = UTC midnight - 8h.
        const startUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0) - 8 * 60 * 60 * 1000;
        const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
        const todayStartIso = new Date(startUtcMs).toISOString();
        const todayEndIso = new Date(endUtcMs).toISOString();

        const { data, error } = await supabase
            .from("plan_instance_executions" as any)
            .select(
                "id, status, completed_sets, total_sets, started_at, completed_at",
            )
            .eq("instance_id", instanceId)
            .eq("day_index", dayIndex)
            .eq("student_id", userId)
            .gte("started_at", todayStartIso)
            .lt("started_at", todayEndIso)
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error("查询执行记录失败:", error);
            return NextResponse.json({ success: false, message: "查询失败" }, {
                status: 500,
            });
        }

        if (!data) {
            return NextResponse.json<ApiData<CheckTodayResponseDto>>({
                success: true,
                message: "查询成功",
                data: null,
            });
        }

        return NextResponse.json<ApiData<CheckTodayResponseDto>>({
            success: true,
            message: "查询成功",
            data: {
                id: data.id,
                status: data.status,
                completed_sets: data.completed_sets,
                total_sets: data.total_sets,
                started_at: data.started_at,
                completed_at: data.completed_at,
            },
        });
    } catch (error) {
        console.error("检查执行状态失败:", error);
        return NextResponse.json<ApiData<CheckTodayResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
