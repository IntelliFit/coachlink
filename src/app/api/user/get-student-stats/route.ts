import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
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

    // 并行查询个人页需要的统计数据
    const [
        subscriptionCountResult,
        activePlanCountResult,
        completedWorkoutsResult,
        planHistoryCountResult,
        actionCountResult,
        planTrainingRecordCountResult,
        impromptuTrainingRecordCountResult,
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

        // 4. 全部计划：与「全部计划」列表保持一致，统计当前 + 历史计划实例
        supabase
            .from("coach_plan_instances")
            .select("*", { count: "exact", head: true })
            .eq("student_id", userId)
            .in("status", ["active", "completed", "archived"]),

        // 5. 我的动作库：统计当前学员自己的动作条目
        supabase
            .from("student_actions")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId),

        // 6. 训练记录：与小程序训练记录页的数据源保持一致
        supabase
            .from("plan_instance_executions")
            .select("*", { count: "exact", head: true })
            .eq("student_id", userId)
            .eq("status", "completed"),

        supabase
            .from("impromptu_executions")
            .select("*", { count: "exact", head: true })
            .eq("student_id", userId)
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
    if (planHistoryCountResult.error) {
        console.error("查询全部计划数量失败:", planHistoryCountResult.error);
    }
    if (actionCountResult.error) {
        console.error("查询我的动作库数量失败:", actionCountResult.error);
    }
    if (planTrainingRecordCountResult.error) {
        console.error("查询计划训练记录数量失败:", planTrainingRecordCountResult.error);
    }
    if (impromptuTrainingRecordCountResult.error) {
        console.error("查询即兴训练记录数量失败:", impromptuTrainingRecordCountResult.error);
    }

    // 计算统计数据
    const subscriptionCount = subscriptionCountResult.count || 0;
    const activePlanCount = activePlanCountResult.count || 0;

    // 对于已完成训练，需要去重 training_date
    const completedDates = new Set(
        (completedWorkoutsResult.data || []).map((r: any) => r.training_date)
    );
    const completedWorkouts = completedDates.size;
    const planHistoryCount = planHistoryCountResult.count || 0;
    const actionCount = actionCountResult.count || 0;
    const trainingRecordCount =
        (planTrainingRecordCountResult.count || 0) +
        (impromptuTrainingRecordCountResult.count || 0);

    return NextResponse.json<ApiData<GetStudentStatsResponseDto>>({
        success: true,
        message: "获取统计数据成功",
        data: {
            subscriptionCount,
            activePlanCount,
            completedWorkouts,
            planHistoryCount,
            actionCount,
            trainingRecordCount,
        },
    });
}
