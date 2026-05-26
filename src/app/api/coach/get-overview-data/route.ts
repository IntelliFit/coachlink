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
        activeSubscriptionsResult,
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
            .select("student_id")
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

    // Coach-owned paid content now follows delayed Huifu settlement. Count it as
    // coach revenue only after local wallet credit exists, not merely after the
    // buyer's source payment succeeds.
    let contentPurchaseRevenueFen = 0;
    try {
        const { data: txs } = await serviceRoleSupabase
            .from("wallet_transactions")
            .select("amount,created_at,type,alipay_order_id")
            .eq("wallet_id", coachId)
            .eq("type", "income")
            .gte("created_at", monthStart.toISOString())
            .lt("created_at", nextMonthStart.toISOString())
            .limit(5000);

        const orderIds = Array.from(new Set(
            (txs || [])
                .map((tx: any) => tx.alipay_order_id)
                .filter((id: any) => typeof id === "string" && id.length > 0),
        ));

        if (orderIds.length > 0) {
            const { data: contentOrders } = await serviceRoleSupabase
                .from("alipay_orders")
                .select("id,order_type")
                .in("id", orderIds)
                .eq("order_type", "content_purchase");
            const contentOrderIds = new Set((contentOrders || []).map((order: any) => order.id));
            contentPurchaseRevenueFen = (txs || []).reduce((sum: number, tx: any) => {
                return contentOrderIds.has(tx.alipay_order_id)
                    ? sum + (Number(tx?.amount) || 0)
                    : sum;
            }, 0);
        }
    } catch (e) {
        console.error("[coach/overview] content purchase revenue calc failed:", e);
    }

    const subscriptionRevenue = fenToYuan(legacySubscriptionRevenueFen + subscriptionOrderRevenueFen);
    const contentPurchaseRevenue = fenToYuan(contentPurchaseRevenueFen);
    const contentCount = contentCountResult.count || 0;
    const actionCount = actionCountResult.count || 0;
    const planTemplateCount = planTemplateCountResult.count || 0;
    const questionReady = Array.isArray(coachQuestionResult.data)
        ? coachQuestionResult.data.some((row: any) => row?.status === "active")
        : false;
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
