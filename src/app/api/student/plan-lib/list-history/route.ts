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
            "id, name, description, source, status, start_date, end_date, created_at, updated_at, training_days",
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

    // 计算每个计划的完成度
    const plansWithStats: PlanHistoryItem[] = (plans || []).map((plan: any) => {
        const trainingDays = plan.training_days || [];
        const totalDays = trainingDays.length;

        // 暂时不计算完成度（需要关联 plan_instance_executions）
        // 后续 Phase 可以增加此逻辑
        return {
            id: plan.id,
            name: plan.name,
            description: plan.description,
            source: plan.source,
            status: plan.status,
            start_date: plan.start_date,
            end_date: plan.end_date,
            created_at: plan.created_at,
            updated_at: plan.updated_at,
            total_days: totalDays,
            // completion_rate 和 completed_days 暂不计算
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
