import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { GetStudentStatsResponseDto } from "@/app/api/student/get-stats/entity";

export async function POST(req: Request) {
    const authResult = await getAuthUser(req);
    if (!authResult.isAuthenticated || !authResult.userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const userId = authResult.userId;

    // 并行查询三个统计数据
    const [
        subscriptionCountResult,
        activePlanCountResult,
        completedWorkoutsResult,
    ] = await Promise.all([
        // 1. 订阅的教练数量：查询 coach_subscriptions 表中 status='active' 的记录数
        supabase
            .from("coach_subscriptions")
            .select("*", { count: "exact", head: true })
            .eq("student_id", userId)
            .eq("status", "active"),

        // 2. 进行中的训练计划数量：查询 coach_plan_instances 表中 status='active' 或 'paused' 的记录数
        supabase
            .from("coach_plan_instances")
            .select("*", { count: "exact", head: true })
            .eq("student_id", userId)
            .in("status", ["active", "paused"]),

        // 3. 已完成训练计划的数量：查询 training_records 表中 status='completed' 的唯一训练日期数
        supabase
            .from("training_records")
            .select("training_date", { count: "exact" })
            .eq("user_id", userId)
            .eq("status", "completed"),
    ]);

    // 处理查询错误
    if (subscriptionCountResult.error) {
        console.error("查询订阅数量失败:", subscriptionCountResult.error);
    }
    if (activePlanCountResult.error) {
        console.error("查询进行中计划数量失败:", activePlanCountResult.error);
    }
    if (completedWorkoutsResult.error) {
        console.error("查询已完成训练数量失败:", completedWorkoutsResult.error);
    }

    // 计算统计数据
    const subscriptionCount = subscriptionCountResult.count || 0;
    const activePlanCount = activePlanCountResult.count || 0;

    // 对于已完成训练，需要去重 training_date
    const completedDates = new Set(
        (completedWorkoutsResult.data || []).map((r: any) => r.training_date)
    );
    const completedWorkouts = completedDates.size;

    return NextResponse.json<ApiData<GetStudentStatsResponseDto>>({
        success: true,
        message: "获取统计数据成功",
        data: {
            subscriptionCount,
            activePlanCount,
            completedWorkouts,
        },
    });
}
