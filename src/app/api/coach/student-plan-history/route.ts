import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type {
    GetStudentPlanHistoryDto,
    GetStudentPlanHistoryResponseDto,
    StudentPlanHistoryItem,
} from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

/**
 * 获取指定学员的计划历史（教练端）
 *
 * 权限：必须是该学员的订阅教练
 */
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

    // 获取教练 ID
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

    // 验证该学员是否是教练的订阅学员
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

    // 获取学员姓名
    const { data: student } = await supabase
        .from("user_profiles")
        .select("nickname")
        .eq("user_id", studentId)
        .single();

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // 构建查询
    let query = supabase
        .from("coach_plan_instances")
        .select(
            "id, name, description, source, status, start_date, end_date, created_at, updated_at, training_days",
            { count: "exact" },
        )
        .eq("student_id", studentId)
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
        console.error("Error fetching student plan history:", error);
        return NextResponse.json({
            success: false,
            message: `获取学员计划历史失败: ${error.message}`,
        }, { status: 500 });
    }

    // 处理结果
    const plansWithStats: StudentPlanHistoryItem[] = (plans || []).map(
        (plan: any) => {
            const trainingDays = plan.training_days || [];
            const totalDays = Array.isArray(trainingDays)
                ? trainingDays.length
                : 0;

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
