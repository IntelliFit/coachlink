import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    GetTrainingMonthShareDto,
    GetTrainingMonthShareResponseDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        const authResult = session?.user?.id
            ? { isAuthenticated: true, userId: session.user.id }
            : await getAuthUser(req);
        if (!authResult.isAuthenticated || !authResult.userId) {
            return NextResponse.json<ApiData<GetTrainingMonthShareResponseDto>>({
                success: false,
                message: "用户未登录",
                data: null,
            }, { status: 401 });
        }
        const userId = authResult.userId;
        const { month } = await req.json() as GetTrainingMonthShareDto;
        if (!/^\d{4}-\d{2}$/.test(month || "")) {
            return NextResponse.json<ApiData<GetTrainingMonthShareResponseDto>>({
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
                .select(
                    "id, started_at, completed_sets, coach_plan_instances:instance_id(source)",
                )
                .eq("student_id", userId)
                .eq("status", "completed")
                .gte("started_at", start)
                .lt("started_at", end),
            supabase
                .from("impromptu_executions")
                .select("id, started_at, completed_sets")
                .eq("student_id", userId)
                .eq("status", "completed")
                .gte("started_at", start)
                .lt("started_at", end),
        ]);

        if (planError || impromptuError) {
            return NextResponse.json<ApiData<GetTrainingMonthShareResponseDto>>({
                success: false,
                message: "获取月度统计失败",
                data: null,
            }, { status: 500 });
        }

        let coachPlan = 0;
        let selfPlan = 0;
        let impromptu = (impromptuExecs || []).length;
        let totalSets = 0;
        const daySet = new Set<string>();

        for (const item of impromptuExecs || []) {
            totalSets += Number(item.completed_sets || 0);
            daySet.add(new Date(item.started_at).toISOString().slice(0, 10));
        }
        for (const item of planExecs || []) {
            const source = (item as any)?.coach_plan_instances?.source;
            if (source === "self" || source === "student") {
                selfPlan += 1;
            } else {
                coachPlan += 1;
            }
            totalSets += Number(item.completed_sets || 0);
            daySet.add(new Date(item.started_at).toISOString().slice(0, 10));
        }

        const totalSessions = coachPlan + selfPlan + impromptu;

        return NextResponse.json<ApiData<GetTrainingMonthShareResponseDto>>({
            success: true,
            message: "获取月度统计成功",
            data: {
                month,
                totalSessions,
                trainingDays: daySet.size,
                totalSets,
                sourceBreakdown: {
                    impromptu,
                    selfPlan,
                    coachPlan,
                },
            },
        });
    } catch (error) {
        console.error("training month share error:", error);
        return NextResponse.json<ApiData<GetTrainingMonthShareResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
