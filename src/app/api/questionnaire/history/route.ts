import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type {
    GetQuestionnaireHistoryDto,
    GetQuestionnaireHistoryResponseDto,
} from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

/**
 * 获取问卷回答历史
 *
 * 权限：
 * - 学员可以查看自己的历史
 * - 教练可以查看其学员的历史
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

    const {
        studentId,
        questionnaireId,
        limit = 50,
    } = await req.json() as GetQuestionnaireHistoryDto;

    // 确定要查询的学员ID
    let targetStudentId = studentId || userId;

    // 权限检查：如果查询的不是自己，需要验证教练权限
    if (studentId && studentId !== userId) {
        if (!session.user.is_coach) {
            return NextResponse.json({
                success: false,
                message: "仅教练可查看学员历史",
            }, { status: 403 });
        }

        // 验证该学员是否是教练的订阅学员
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
    }

    // 构建查询
    let query = supabase
        .from("questionnaire_responses")
        .select("*", { count: "exact" })
        .eq("student_id", targetStudentId)
        .order("created_at", { ascending: false })
        .limit(limit);

    // 可选：筛选特定问卷
    if (questionnaireId) {
        query = query.eq("questionnaire_id", questionnaireId);
    }

    const { data: responses, count, error } = await query;

    if (error) {
        console.error("Error fetching questionnaire history:", error);
        return NextResponse.json({
            success: false,
            message: `获取问卷历史失败: ${error.message}`,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<GetQuestionnaireHistoryResponseDto>>({
        success: true,
        message: "获取问卷历史成功",
        data: {
            responses: responses || [],
            totalCount: count || 0,
        },
    });
}
