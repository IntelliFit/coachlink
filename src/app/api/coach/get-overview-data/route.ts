import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { buildCoachMonthlyRevenueSummary } from "@/lib/coachRevenueSummary";
import { GetOverviewDataResponseDto } from "./entity";

export async function POST(req: Request) {
    const session = await getServerSession();
    const authResult = session?.user?.id
        ? { isAuthenticated: true, userId: session.user.id }
        : await getAuthUser(req);
    if (!authResult.isAuthenticated || !authResult.userId) {
        return NextResponse.json({ success: false, message: "未登录" }, {
            status: 401,
        });
    }

    const userId = authResult.userId;

    // 1. 获取教练基础信息（可添加缓存逻辑）
    const { data: coach, error: coachError } = await supabase
        .from("coaches")
        .select("id, huifu_open_status, huifu_card_token, huifu_open_msg")
        .eq("user_id", userId)
        .single();

    if (coachError || !coach) {
        return NextResponse.json({ success: false, message: "教练不存在" }, {
            status: 404,
        });
    }

    const coachId = coach.id;
    // NOTE: start_date is intentionally null until the student actually starts training.
    // Do NOT use start_date as a filter for overview stats.
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // 2. 并行执行聚合查询
    const [
        activeSubscriptionsResult,
        pendingReviewResult,
        ratingResult,
        contentCountResult,
        planTemplateCountResult,
        actionCountResult,
        coachQuestionResult,
        coachPricingResult,
    ] = await Promise.all([
        // 总学员数：与“学员管理”页口径一致（active 订阅数；不应依赖 start_date 是否已设置）
        supabase
            .from("coach_subscriptions")
            .select("student_id")
            .eq("coach_id", coachId)
            .eq("status", "active"),

        // 假设 training_videos 表有 coach_id 或可以通过关联查询
        supabase
            .from("training_videos")
            .select("*", { count: "exact", head: true })
            .eq("coach_id", coachId)
            .eq("requires_review", true)
            .eq("review_status", "pending")
            .is("deleted_at", null),

        supabase
            .from("student_comments")
            .select("rating")
            .eq("coach_id", coachId),

        supabase
            .from("coach_contents")
            .select("*", { count: "exact", head: true })
            .eq("coach_id", coachId),

        supabase
            .from("coach_plan_templates")
            .select("*", { count: "exact", head: true })
            .eq("coach_id", userId),

        supabase
            .from("coach_actions")
            .select("*", { count: "exact", head: true })
            .eq("coach_id", userId),

        supabase
            .from("coach_questionnaires")
            .select("id, status")
            .eq("coach_id", userId),

        supabase
            .from("coach_pricing")
            .select("id")
            .eq("coach_id", coachId)
            .maybeSingle(),
    ]);

    // 3. 内存处理聚合数据
    const activeStudentIds = Array.from(new Set(
        (activeSubscriptionsResult.data || [])
            .map((row: any) => row.student_id)
            .filter(Boolean),
    ));
    let totalStudentCount = 0;
    if (activeStudentIds.length > 0) {
        const [{ data: activeUsers }, { data: activeProfiles }] = await Promise.all([
            supabase
                .from("users")
                .select("id")
                .in("id", activeStudentIds)
                .or("phone.not.is.null,email.not.is.null,wechat_openid.not.is.null"),
            supabase
                .from("user_profiles")
                .select("user_id, nickname, full_name")
                .in("user_id", activeStudentIds),
        ]);

        const activeUserSet = new Set((activeUsers || []).map((user: any) => user.id));
        const visibleProfileSet = new Set(
            (activeProfiles || [])
                .filter((profile: any) => profile?.nickname || profile?.full_name)
                .map((profile: any) => profile.user_id),
        );

        totalStudentCount = activeStudentIds.filter((studentId) =>
            activeUserSet.has(studentId) && visibleProfileSet.has(studentId),
        ).length;
    }
    const pendingReviewCount = pendingReviewResult.count || 0;

    let revenueSummary = {
        subscriptionRevenue: 0,
        contentPurchaseRevenue: 0,
        totalRevenue: 0,
        items: [],
    };
    try {
        revenueSummary = await buildCoachMonthlyRevenueSummary({
            coachId,
            monthStart,
            nextMonthStart,
        });
    } catch (e) {
        console.error("[coach/overview] revenue calc failed:", e);
    }

    const contentCount = contentCountResult.count || 0;
    const actionCount = actionCountResult.count || 0;
    const planTemplateCount = planTemplateCountResult.count || 0;
    const questionReady = Array.isArray(coachQuestionResult.data)
        ? coachQuestionResult.data.some((row: any) => row?.status === "active")
        : false;
    const pricingReady = Boolean(coachPricingResult.data);
    const receivingAccountReady = Boolean(
        coach.huifu_open_status === "opened" && coach.huifu_card_token,
    );

    const ratings = ratingResult.data || [];
    const averageRating = ratings.length > 0
        ? parseFloat(
            (ratings.reduce((sum, r) => sum + (r.rating || 0), 0) /
                ratings.length).toFixed(1),
        )
        : 0;

    return NextResponse.json<ApiData<GetOverviewDataResponseDto>>({
        success: true,
        data: {
            totalStudentCount,
            pendingReviewCount,
            averageRating,
            monthlyRevenue: revenueSummary.totalRevenue,
            contentCount,
            actionCount,
            planTemplateCount,
            questionReady,
            pricingReady,
            receivingAccountReady,
            huifuOpenStatus: coach.huifu_open_status ?? null,
            huifuOpenMsg: coach.huifu_open_msg ?? null,
        },
    });
}
