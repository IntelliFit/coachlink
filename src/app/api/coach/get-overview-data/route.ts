import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { isSubscriptionOrderTableMissingError } from "@/lib/subscriptionOrders";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { fenToYuan } from "@/lib/moneyUtils";
import { GetOverviewDataResponseDto } from "./entity";

const SUBSCRIPTION_ORDER_CUTOVER_AT = new Date("2026-04-22T00:00:00+08:00").getTime();

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
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // 2. 并行执行聚合查询
    const [
        activeStudentCountResult,
        subscriptionRevenueResult,
        subscriptionOrderRevenueResult,
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

        // 订阅收入：沿用历史口径（active 订阅月费），但按月份过滤到“本月”
        supabase
            .from("coach_subscriptions")
            .select("monthly_price,created_at,payment_confirmed_at,payment_confirmed_by,status")
            .eq("coach_id", coachId)
            .limit(5000),

        serviceRoleSupabase
            .from("coach_subscription_orders" as any)
            .select("amount_fen,payment_confirmed_at,status")
            .eq("coach_id", coachId)
            .eq("status", "paid")
            .limit(5000),

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
            .eq("is_active", true)
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

    // monthly_price 在 DB 中为分；按“确认支付时间(优先) / 创建时间(兜底)”过滤到本月
    const legacySubscriptionRevenueFen = (subscriptionRevenueResult.data || []).reduce(
        (sum, row: any) => {
            const isPaidLike = Boolean(
                row?.payment_confirmed_at ||
                row?.payment_confirmed_by ||
                row?.status === "active",
            );
            if (!isPaidLike) return sum;
            const revenueAtRaw = row?.payment_confirmed_at || row?.created_at;
            if (!revenueAtRaw) return sum;
            const revenueAtMs = new Date(revenueAtRaw).getTime();
            if (Number.isNaN(revenueAtMs)) return sum;
            if (revenueAtMs >= SUBSCRIPTION_ORDER_CUTOVER_AT) return sum;
            if (
                revenueAtMs < monthStart.getTime() ||
                revenueAtMs >= nextMonthStart.getTime()
            ) {
                return sum;
            }
            return sum + (Number(row?.monthly_price) || 0);
        },
        0,
    );

    if (
        subscriptionOrderRevenueResult.error &&
        !isSubscriptionOrderTableMissingError(subscriptionOrderRevenueResult.error.message)
    ) {
        return NextResponse.json({
            success: false,
            message: subscriptionOrderRevenueResult.error.message,
        }, {
            status: 500,
        });
    }

    const subscriptionOrderRevenueFen = ((subscriptionOrderRevenueResult.data || []) as any[]).reduce(
        (sum: number, row: any) => {
            const revenueAtRaw = row?.payment_confirmed_at;
            if (!revenueAtRaw) return sum;
            const revenueAtMs = new Date(revenueAtRaw).getTime();
            if (Number.isNaN(revenueAtMs)) return sum;
            if (
                revenueAtMs < monthStart.getTime() ||
                revenueAtMs >= nextMonthStart.getTime()
            ) {
                return sum;
            }
            return sum + (Number(row?.amount_fen) || 0);
        },
        0,
    );

    // 单篇文章购买收入（按当月已支付订单汇总到“本月收入”）
    let contentPurchaseRevenueFen = 0;
    try {
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

    const subscriptionRevenue = fenToYuan(legacySubscriptionRevenueFen + subscriptionOrderRevenueFen);
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
            monthlyRevenue: subscriptionRevenue + contentPurchaseRevenue,
            contentCount,
            actionCount,
            planTemplateCount,
            questionReady,
            pricingReady,
        },
    });
}
