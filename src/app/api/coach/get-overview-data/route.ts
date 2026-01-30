import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { fenToYuan } from "@/lib/moneyUtils";
import { GetOverviewDataResponseDto } from "./entity";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "未登录" }, {
            status: 401,
        });
    }

    const userId = session.user.id;

    // 1. 获取教练基础信息（可添加缓存逻辑）
    const { data: coach, error: coachError } = await supabase
        .from("coaches")
        .select("id")
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

    // 2. 并行执行聚合查询
    const [
        activeStudentCountResult,
        activeRevenueResult,
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
            .select("id", { count: "exact", head: true })
            .eq("coach_id", coachId)
            .eq("status", "active"),

        // 本月收入（当前口径）：active 订阅金额汇总（与教练端“业务概览”历史表现一致）
        // 关键修复：不要依赖 start_date（新订阅 start_date = null，直到学员真正开始训练）
        supabase
            .from("coach_subscriptions")
            .select("monthly_price")
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
            .select("id")
            .eq("coach_id", userId)
            .maybeSingle(),

        supabase
            .from("coach_pricing")
            .select("id")
            .eq("coach_id", coachId)
            .maybeSingle(),
    ]);

    // 3. 内存处理聚合数据
    const totalStudentCount = activeStudentCountResult.count || 0;
    const pendingReviewCount = pendingReviewResult.count || 0;

    // monthly_price 在 DB 中为分；求和后转为元返回给前端展示
    const monthlyRevenueFen = (activeRevenueResult.data || []).reduce(
        (sum, row: any) => sum + (Number(row?.monthly_price) || 0),
        0,
    );

    // 单篇文章购买收入（按当月已支付订单汇总到“本月收入”）
    // 说明：目前为 GMV 口径（平台收款，后续结算给教练）；展示在概览中更符合业务预期。
    let contentPurchaseRevenueFen = 0;
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        // 1) 取该教练的内容 id
        const { data: contents } = await serviceRoleSupabase
            .from("coach_contents")
            .select("id")
            .eq("coach_id", coachId)
            .limit(5000);

        const contentIds = (contents || []).map((c: any) => c.id).filter(Boolean);
        if (contentIds.length > 0) {
            // 2) 取当月已支付的购买记录（含 order_id）
            const { data: purchases } = await serviceRoleSupabase
                .from("content_purchases" as any)
                .select("order_id,paid_at,status")
                .in("content_id", contentIds)
                .eq("status", "paid")
                .gte("paid_at", monthStart.toISOString())
                .lt("paid_at", nextMonthStart.toISOString())
                .limit(5000);

            const orderIds = Array.from(
                new Set(
                    (purchases || [])
                        .map((p: any) => p.order_id)
                        .filter((id: any) => typeof id === "string" && id.length > 0),
                ),
            );

            if (orderIds.length > 0) {
                const { data: orders } = await serviceRoleSupabase
                    .from("alipay_orders")
                    .select("id,total_amount,status,order_type")
                    .in("id", orderIds)
                    .eq("status", "paid")
                    .eq("order_type", "content_purchase");

                contentPurchaseRevenueFen = (orders || []).reduce(
                    (sum: number, o: any) => sum + (Number(o?.total_amount) || 0),
                    0,
                );
            }
        }
    } catch (e) {
        console.error("[coach/overview] content purchase revenue calc failed:", e);
    }

    const monthlyRevenue = fenToYuan(monthlyRevenueFen);
    const contentPurchaseRevenue = fenToYuan(contentPurchaseRevenueFen);
    const contentCount = contentCountResult.count || 0;
    const actionCount = actionCountResult.count || 0;
    const planTemplateCount = planTemplateCountResult.count || 0;
    const questionReady = Boolean(coachQuestionResult.data);
    const pricingReady = Boolean(coachPricingResult.data);

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
            monthlyRevenue: monthlyRevenue + contentPurchaseRevenue,
            contentCount,
            actionCount,
            planTemplateCount,
            questionReady,
            pricingReady,
        },
    });
}
