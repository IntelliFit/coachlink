import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    GetTrainingCalendarDto,
    GetTrainingCalendarResponseDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        const authResult = session?.user?.id
            ? { isAuthenticated: true, userId: session.user.id }
            : await getAuthUser(req);
        if (!authResult.isAuthenticated || !authResult.userId) {
            return NextResponse.json<ApiData<GetTrainingCalendarResponseDto>>({
                success: false,
                message: "用户未登录",
                data: null,
            }, { status: 401 });
        }
        const userId = authResult.userId;
        const { month } = await req.json() as GetTrainingCalendarDto;
        if (!/^\d{4}-\d{2}$/.test(month || "")) {
            return NextResponse.json<ApiData<GetTrainingCalendarResponseDto>>({
                success: false,
                message: "month 参数格式错误",
                data: null,
            }, { status: 400 });
        }

        const start = `${month}-01T00:00:00.000Z`;
        const monthDate = new Date(`${month}-01T00:00:00.000Z`);
        const nextMonthDate = new Date(monthDate);
        nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1);
        const end = nextMonthDate.toISOString();

        const [{ data: planExecs, error: planError }, {
            data: impromptuExecs,
            error: impromptuError,
        }] = await Promise.all([
            supabase
                .from("plan_instance_executions")
                .select("started_at")
                .eq("student_id", userId)
                .eq("status", "completed")
                .gte("started_at", start)
                .lt("started_at", end),
            supabase
                .from("impromptu_executions")
                .select("started_at")
                .eq("student_id", userId)
                .eq("status", "completed")
                .gte("started_at", start)
                .lt("started_at", end),
        ]);

        if (planError || impromptuError) {
            return NextResponse.json<ApiData<GetTrainingCalendarResponseDto>>({
                success: false,
                message: "获取训练日历失败",
                data: null,
            }, { status: 500 });
        }

        const dayMap = new Map<string, number>();
        const allRows = [...(planExecs || []), ...(impromptuExecs || [])];
        for (const row of allRows) {
            const day = new Date(row.started_at).toISOString().slice(0, 10);
            dayMap.set(day, (dayMap.get(day) || 0) + 1);
        }

        const days = Array.from(dayMap.entries())
            .map(([date, sessions]) => ({ date, sessions }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return NextResponse.json<ApiData<GetTrainingCalendarResponseDto>>({
            success: true,
            message: "获取训练日历成功",
            data: { days },
        });
    } catch (error) {
        console.error("training history calendar error:", error);
        return NextResponse.json<ApiData<GetTrainingCalendarResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
