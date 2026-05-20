import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { isSubscriptionOrderTableMissingError } from "@/lib/subscriptionOrders";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import { fenToYuan } from "@/lib/moneyUtils";
import type { ApiData } from "@/types/api";
import type {
    GetRevenueDetailsDto,
    GetRevenueDetailsResponseDto,
    RevenueItem,
} from "./entity";

const SUBSCRIPTION_ORDER_CUTOVER_AT = new Date("2026-04-22T00:00:00+08:00").getTime();

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const userId = session.user.id;

    // 获取教练 ID
    const { data: coach, error: coachError } = await supabase
        .from("coaches")
        .select("id")
        .eq("user_id", userId)
        .single();

    if (coachError || !coach) {
        return NextResponse.json({
            success: false,
            message: "教练不存在",
            data: null,
        }, { status: 404 });
    }

    const coachId = coach.id;

    let reqData: GetRevenueDetailsDto = {};
    try {
        reqData = await req.json();
    } catch {
        // 使用默认值
    }

    // 计算月份范围
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth(); // 0-indexed

    if (reqData.month) {
        const parts = reqData.month.split("-");
        if (parts.length === 2) {
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
        }
    }

    const monthStart = new Date(year, month, 1);
    const nextMonthStart = new Date(year, month + 1, 1);

    const items: RevenueItem[] = [];
    let subscriptionRevenueFen = 0;
    let contentPurchaseRevenueFen = 0;

    const { data: subscriptionOrders, error: subscriptionOrderError } = await serviceRoleSupabase
        .from("coach_subscription_orders" as any)
        .select(`
            id,
            amount_fen,
            payment_confirmed_at,
            student_id,
            order_type
        `)
        .eq("coach_id", coachId)
        .eq("status", "paid")
        .gte("payment_confirmed_at", monthStart.toISOString())
        .lt("payment_confirmed_at", nextMonthStart.toISOString())
        .limit(5000);

    if (
        subscriptionOrderError &&
        !isSubscriptionOrderTableMissingError(subscriptionOrderError.message)
    ) {
        return NextResponse.json({
            success: false,
            message: subscriptionOrderError.message,
            data: null,
        }, { status: 500 });
    }

    // 1. 查询订阅收入（沿用历史来源：coach_subscriptions.monthly_price）
    const { data: subscriptions } = await supabase
        .from("coach_subscriptions")
        .select(`
            id,
            monthly_price,
            created_at,
            payment_confirmed_at,
            payment_confirmed_by,
            status,
            student_id
        `)
        .eq("coach_id", coachId)
        .limit(5000);

    const filteredSubscriptions = (subscriptions || []).filter((sub: any) => {
        const isPaidLike = Boolean(
            sub?.payment_confirmed_at ||
            sub?.payment_confirmed_by ||
            sub?.status === "active",
        );
        if (!isPaidLike) return false;
        const revenueAtRaw = sub?.payment_confirmed_at || sub?.created_at;
        if (!revenueAtRaw) return false;
        const revenueAtMs = new Date(revenueAtRaw).getTime();
        if (Number.isNaN(revenueAtMs)) return false;
        if (revenueAtMs >= SUBSCRIPTION_ORDER_CUTOVER_AT) return false;
        return revenueAtMs >= monthStart.getTime() &&
            revenueAtMs < nextMonthStart.getTime();
    });

    // 2. 查询内容购买收入
    const { data: contents } = await serviceRoleSupabase
        .from("coach_contents")
        .select("id, title")
        .eq("coach_id", coachId)
        .limit(5000);

    const contentMap = new Map<string, string>();
    const contentIds: string[] = [];
    if (contents) {
        for (const c of contents) {
            contentIds.push(c.id);
            contentMap.set(c.id, c.title || "未命名文章");
        }
    }

    let purchases: any[] = [];
    if (contentIds.length > 0) {
        const { data: pData } = await serviceRoleSupabase
            .from("content_purchases" as any)
            .select(`
                id,
                content_id,
                user_id,
                order_id,
                paid_at
            `)
            .in("content_id", contentIds)
            .eq("status", "paid")
            .gte("paid_at", monthStart.toISOString())
            .lt("paid_at", nextMonthStart.toISOString());
        purchases = pData || [];
    }

    // 3. 读取相关学员昵称
    const userIds = new Set<string>();
    filteredSubscriptions.forEach((sub: any) => sub.student_id && userIds.add(sub.student_id));
    (subscriptionOrders || []).forEach((order: any) => order.student_id && userIds.add(order.student_id));
    purchases.forEach((p: any) => p.user_id && userIds.add(p.user_id));

    const userProfileMap = new Map<string, string>();
    if (userIds.size > 0) {
        const { data: profiles } = await supabase
            .from("user_profiles")
            .select("user_id, nickname, full_name")
            .in("user_id", Array.from(userIds));

        if (profiles) {
            profiles.forEach((p: any) => {
                const displayName = (p?.nickname || p?.full_name || "").trim();
                if (p.user_id && displayName) {
                    userProfileMap.set(p.user_id, displayName);
                }
            });
        }
    }

    // 4. 组装订阅收入明细（按月过滤后）
    for (const order of subscriptionOrders || []) {
        const amountFen = Number(order.amount_fen) || 0;
        subscriptionRevenueFen += amountFen;

        const studentName = userProfileMap.get(order.student_id) || "未知学员";
        const suffix = order.order_type === "renew" ? "（续费）" : "";

        items.push({
            id: order.id,
            type: "subscription",
            amount: fenToYuan(amountFen),
            description: `订阅收入${suffix} - ${studentName}`,
            createdAt: order.payment_confirmed_at,
            studentName,
        });
    }

    for (const sub of filteredSubscriptions) {
        const amountFen = Number(sub.monthly_price) || 0;
        subscriptionRevenueFen += amountFen;

        const studentName = userProfileMap.get(sub.student_id) || "未知学员";
        const revenueAt = sub.payment_confirmed_at || sub.created_at || monthStart.toISOString();

        items.push({
            id: sub.id,
            type: "subscription",
            amount: fenToYuan(amountFen),
            description: `订阅月费 - ${studentName}`,
            createdAt: revenueAt,
            studentName,
        });
    }

    // 5. 组装文章购买收入明细（保持原有口径）
    if (purchases.length > 0) {
        const orderIds = purchases
            .map((p: any) => p.order_id)
            .filter((id: any) => typeof id === "string" && id.length > 0);

        const orderIncomeMap = new Map<string, number>();
        if (orderIds.length > 0) {
            const { data: incomeTxs } = await serviceRoleSupabase
                .from("wallet_transactions")
                .select("alipay_order_id, amount")
                .eq("wallet_id", coachId)
                .eq("type", "income")
                .in("alipay_order_id", orderIds);

            if (incomeTxs) {
                for (const tx of incomeTxs as any[]) {
                    const id = String(tx.alipay_order_id || "");
                    if (!id) continue;
                    orderIncomeMap.set(id, (orderIncomeMap.get(id) || 0) + (Number(tx.amount) || 0));
                }
            }
        }

        for (const p of purchases) {
            const amountFen = orderIncomeMap.get(p.order_id) || 0;
            if (amountFen <= 0) continue;
            contentPurchaseRevenueFen += amountFen;

            const contentTitle = contentMap.get(p.content_id) || "未命名文章";
            const buyerName = userProfileMap.get(p.user_id) || "匿名用户";

            items.push({
                id: p.id,
                type: "content_purchase",
                amount: fenToYuan(amountFen),
                description: `文章购买 - ${contentTitle}`,
                createdAt: p.paid_at,
                studentName: buyerName,
                contentTitle,
            });
        }
    }

    // 统一按时间倒序
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const subscriptionRevenue = fenToYuan(subscriptionRevenueFen);
    const contentPurchaseRevenue = fenToYuan(contentPurchaseRevenueFen);
    const totalRevenue = subscriptionRevenue + contentPurchaseRevenue;

    return NextResponse.json<ApiData<GetRevenueDetailsResponseDto>>({
        success: true,
        message: "获取收入明细成功",
        data: {
            subscriptionRevenue,
            contentPurchaseRevenue,
            totalRevenue,
            items,
        },
    });
}
