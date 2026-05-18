import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type {
    GetStudentPlanHistoryDto,
    GetStudentPlanHistoryResponseDto,
    StudentPlanHistoryItem,
} from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
        }, { status: 401 });
    }

    if (!session.user.is_coach) {
        return NextResponse.json({
            success: false,
            message: "仅教练可访问",
        }, { status: 403 });
    }

    const { studentId, page = 1, limit = 20, source = "all" } = await req
        .json() as GetStudentPlanHistoryDto;

    if (!studentId) {
        return NextResponse.json({
            success: false,
            message: "缺少 studentId 参数",
        }, { status: 400 });
    }

    const { data: coach } = await supabase
        .from("coaches")
        .select("id")
        .eq("user_id", userId)
        .single();

    if (!coach) {
        return NextResponse.json({
            success: false,
            message: "教练信息不存在",
        }, { status: 404 });
    }

    const { data: subscription } = await supabase
        .from("coach_subscriptions")
        .select("id")
        .eq("coach_id", coach.id)
        .eq("student_id", studentId)
        .maybeSingle();

    if (!subscription) {
        return NextResponse.json({
            success: false,
            message: "该学员不是您的订阅学员",
        }, { status: 403 });
    }

    const { data: student } = await supabase
        .from("user_profiles")
        .select("nickname")
        .eq("user_id", studentId)
        .single();

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
        .from("coach_plan_instances")
        .select(
            "id, name, description, source, status, start_date, end_date, start_execution_day, created_at, updated_at, training_days, archive_reason, entitlement_consumption_policy",
            { count: "exact" },
        )
        .eq("student_id", studentId)
        .order("updated_at", { ascending: false })
        .range(from, to);

    if (source === "coach") {
        query = query.eq("source", "coach");
    } else if (source === "student") {
        query = query.or("source.eq.student,source.eq.self");
    }

    const { data: plans, count, error } = await query;

    if (error) {
        console.error("Error fetching student plan history:", error);
        return NextResponse.json({
            success: false,
            message: `获取学员计划历史失败: ${error.message}`,
        }, { status: 500 });
    }

    const planIds = (plans || [])
        .map((plan: any) => plan?.id)
        .filter(Boolean);
    const { data: resolvedExecutions } = planIds.length > 0
        ? await supabase
            .from("plan_instance_executions")
            .select("instance_id, day_index, status, completed_at, updated_at")
            .in("instance_id", planIds)
            .in("status", ["completed", "abandoned"])
        : { data: [] as any[] };

    const resolvedDaySetByInstanceId = new Map<string, Set<number>>();
    const latestResolvedAtByInstanceId = new Map<string, string>();

    for (const exec of resolvedExecutions || []) {
        const instanceId = String((exec as any)?.instance_id || "");
        if (!instanceId) continue;
        const dayIndex = Number((exec as any)?.day_index ?? 0);
        if (!dayIndex) continue;

        const existing = resolvedDaySetByInstanceId.get(instanceId) ||
            new Set<number>();
        existing.add(dayIndex);
        resolvedDaySetByInstanceId.set(instanceId, existing);

        const resolvedAt = (exec as any)?.completed_at || (exec as any)?.updated_at;
        if (resolvedAt) {
            const current = latestResolvedAtByInstanceId.get(instanceId);
            if (
                !current ||
                new Date(String(resolvedAt)).getTime() >=
                    new Date(String(current)).getTime()
            ) {
                latestResolvedAtByInstanceId.set(instanceId, String(resolvedAt));
            }
        }
    }

    const plansWithStats: StudentPlanHistoryItem[] = (plans || []).map(
        (plan: any) => {
            const dayList = Array.isArray(plan.training_days)
                ? plan.training_days
                : [];
            const startExecutionDay = Number(plan.start_execution_day || 1);
            const trainingDayIndexes = dayList
                .map((day: any, index: number) => ({
                    dayIndex: Number(day?.dayIndex ?? day?.day_index ?? (index + 1)),
                    type: String(day?.type || "").trim().toLowerCase(),
                }))
                .filter((item: any) =>
                    item.type !== "rest" &&
                    item.dayIndex >= startExecutionDay &&
                    item.dayIndex > 0
                )
                .map((item: any) => item.dayIndex);

            const resolvedDays = resolvedDaySetByInstanceId.get(plan.id) ||
                new Set<number>();
            const completedDays = trainingDayIndexes.filter((dayIndex: number) =>
                resolvedDays.has(dayIndex)
            ).length;
            const totalTrainingDays = trainingDayIndexes.length;
            const completionRate = totalTrainingDays > 0
                ? Math.round((completedDays / totalTrainingDays) * 100)
                : undefined;
            const isLogicallyCompleted = totalTrainingDays > 0 &&
                completedDays >= totalTrainingDays;
            const normalizedStatus = String(plan.status || "").trim().toLowerCase();
            const displayStatus = normalizedStatus === "active" &&
                    isLogicallyCompleted
                ? "completed"
                : plan.status;
            const shouldDeriveEndDate = !plan.end_date &&
                (
                    isLogicallyCompleted ||
                    normalizedStatus === "completed" ||
                    normalizedStatus === "archived"
                );
            const derivedEndDate = shouldDeriveEndDate
                ? (latestResolvedAtByInstanceId.get(plan.id) || plan.updated_at || null)
                : plan.end_date;

            return {
                id: plan.id,
                name: plan.name,
                description: plan.description,
                source: plan.source,
                status: displayStatus,
                start_date: plan.start_date,
                end_date: derivedEndDate,
                created_at: plan.created_at,
                updated_at: plan.updated_at,
                total_days: totalTrainingDays,
                total_training_days: totalTrainingDays,
                plan_span_days: dayList.length,
                completed_days: completedDays,
                completion_rate: completionRate,
                archive_reason: plan.archive_reason || null,
                entitlement_consumption_policy:
                    plan.entitlement_consumption_policy || null,
            };
        },
    );

    return NextResponse.json<ApiData<GetStudentPlanHistoryResponseDto>>({
        success: true,
        message: "获取学员计划历史成功",
        data: {
            plans: plansWithStats,
            totalCount: count || 0,
            page,
            limit,
            studentName: student?.nickname || "未知学员",
        },
    });
}
