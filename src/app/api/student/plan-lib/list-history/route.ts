import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type {
    ListHistoryDto,
    ListHistoryResponseDto,
    PlanHistoryItem,
} from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

/**
 * 获取学员的计划列表（包含当前和历史）
 *
 * 返回所有计划：active（当前）、completed（已完成）、archived（已归档）
 * 支持按 source 筛选（教练指派 / 学员自制）
 */
export async function POST(req: Request) {
    const { page = 1, limit = 20, source = "all" } = await req
        .json() as ListHistoryDto;

    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
        }, { status: 401 });
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // 构建查询 - 包含 active, completed, archived
    let query = supabase
        .from("coach_plan_instances")
        .select(
            "id, name, description, source, status, start_date, end_date, start_execution_day, created_at, updated_at, training_days",
            { count: "exact" },
        )
        .eq("student_id", userId)
        .in("status", ["active", "completed", "archived"])
        .order("status", { ascending: true }) // active 排在前面（字母序）
        .order("updated_at", { ascending: false })
        .range(from, to);

    // 按来源筛选
    if (source === "coach") {
        query = query.eq("source", "coach");
    } else if (source === "student") {
        query = query.or("source.eq.student,source.eq.self");
    }

    const { data: plans, count, error } = await query;

    if (error) {
        console.error("Error fetching plan history:", error);
        return NextResponse.json({
            success: false,
            message: `获取历史计划失败: ${error.message}`,
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

    // 计算每个计划的真实完成度，并修正“逻辑已完成但状态仍 active”的展示。
    const plansWithStats: PlanHistoryItem[] = (plans || []).map((plan: any) => {
        const dayList = Array.isArray(plan.training_days) ? plan.training_days : [];
        const startExecutionDay = Number(plan.start_execution_day || 1);
        const getDayIndex = (day: any, index: number) =>
            Number(day?.dayIndex ?? day?.day_index ?? (index + 1));
        const isTrainingDay = (day: any) => {
            const type = String(day?.type || "").trim().toLowerCase();
            // 兼容旧数据：无 type 时默认按训练日处理；只有 rest 明确排除。
            return type !== "rest";
        };

        const trainingDayIndexes = dayList
            .map((day: any, index: number) => ({
                dayIndex: getDayIndex(day, index),
                isTraining: isTrainingDay(day),
            }))
            .filter((item: any) =>
                item.isTraining &&
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
        const derivedEndDate = isLogicallyCompleted && !plan.end_date
            ? (latestResolvedAtByInstanceId.get(plan.id) || null)
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
            completed_days: completedDays,
            completion_rate: completionRate,
        };
    });

    return NextResponse.json<ApiData<ListHistoryResponseDto>>({
        success: true,
        message: "获取历史计划成功",
        data: {
            plans: plansWithStats,
            totalCount: count || 0,
            page,
            limit,
        },
    });
}
