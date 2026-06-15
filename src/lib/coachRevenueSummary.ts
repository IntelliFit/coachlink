import { fenToYuan } from "@/lib/moneyUtils";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

type RevenueItemType = "subscription" | "content_purchase";

export interface CoachRevenueItem {
    id: string;
    type: RevenueItemType;
    amount: number;
    description: string;
    createdAt: string;
    studentName?: string;
    contentTitle?: string;
}

interface BuildCoachMonthlyRevenueInput {
    coachId: string;
    monthStart: Date;
    nextMonthStart: Date;
    includeItems?: boolean;
}

interface BuildCoachMonthlyRevenueResult {
    subscriptionRevenue: number;
    contentPurchaseRevenue: number;
    totalRevenue: number;
    items: CoachRevenueItem[];
}

type WalletIncomeRow = {
    id: string;
    amount: number | null;
    created_at: string;
    description: string | null;
    alipay_order_id: string | null;
};

type PendingSettlementRow = {
    id: string;
    alipay_order_id: string;
    student_id: string | null;
    coach_amount: number | null;
    created_at: string;
};

type LegacySubscriptionRow = {
    id: string;
    monthly_price: number | null;
    created_at: string | null;
    payment_confirmed_at: string | null;
    payment_confirmed_by: string | null;
    status: string | null;
    student_id: string | null;
};

const SUBSCRIPTION_ORDER_CUTOVER_AT = new Date("2026-04-22T00:00:00+08:00").getTime();

function isContentOrderType(orderType: string | null | undefined) {
    return orderType === "content_purchase";
}

function getDisplayName(profile?: { nickname: string | null; full_name: string | null } | null) {
    return profile?.nickname?.trim() || profile?.full_name?.trim() || null;
}

function getRevenueAt(row: LegacySubscriptionRow) {
    const isPaidLike = Boolean(
        row.payment_confirmed_at ||
        row.payment_confirmed_by ||
        row.status === "active",
    );
    if (!isPaidLike) return null;

    const raw = row.payment_confirmed_at || row.created_at;
    if (!raw) return null;

    const ms = new Date(raw).getTime();
    if (Number.isNaN(ms) || ms >= SUBSCRIPTION_ORDER_CUTOVER_AT) return null;

    return { raw, ms };
}

export async function buildCoachMonthlyRevenueSummary({
    coachId,
    monthStart,
    nextMonthStart,
    includeItems = false,
}: BuildCoachMonthlyRevenueInput): Promise<BuildCoachMonthlyRevenueResult> {
    const [incomeResult, pendingSettlementResult, legacySubscriptionResult] = await Promise.all([
        serviceRoleSupabase
            .from("wallet_transactions")
            .select("id, amount, created_at, description, alipay_order_id")
            .eq("wallet_id", coachId)
            .eq("type", "income")
            .gte("created_at", monthStart.toISOString())
            .lt("created_at", nextMonthStart.toISOString())
            .limit(5000),
        serviceRoleSupabase
            .from("coach_subscription_settlements" as any)
            .select("id, alipay_order_id, student_id, coach_amount, created_at")
            .eq("coach_id", coachId)
            .in("status", ["pending", "processing", "split_failed"])
            .gte("created_at", monthStart.toISOString())
            .lt("created_at", nextMonthStart.toISOString())
            .limit(5000),
        serviceRoleSupabase
            .from("coach_subscriptions")
            .select("id, monthly_price, created_at, payment_confirmed_at, payment_confirmed_by, status, student_id")
            .eq("coach_id", coachId)
            .limit(5000),
    ]);

    if (incomeResult.error) throw new Error(incomeResult.error.message);
    if (pendingSettlementResult.error) throw new Error(pendingSettlementResult.error.message);
    if (legacySubscriptionResult.error) throw new Error(legacySubscriptionResult.error.message);

    const incomeRows = (incomeResult.data ?? []) as WalletIncomeRow[];
    const pendingSettlementRows = (pendingSettlementResult.data ?? []) as PendingSettlementRow[];
    const legacyRows = ((legacySubscriptionResult.data ?? []) as LegacySubscriptionRow[]).filter((row) => {
        const revenueAt = getRevenueAt(row);
        return revenueAt &&
            revenueAt.ms >= monthStart.getTime() &&
            revenueAt.ms < nextMonthStart.getTime();
    });

    const orderIds = Array.from(new Set([
        ...incomeRows.map((row) => row.alipay_order_id),
        ...pendingSettlementRows.map((row) => row.alipay_order_id),
    ].filter((id): id is string => Boolean(id))));

    let ordersById = new Map<string, {
        id: string;
        order_type: string | null;
        user_id: string | null;
        subject: string | null;
        order_data: Record<string, unknown> | null;
    }>();

    if (orderIds.length > 0) {
        const { data: orders, error } = await serviceRoleSupabase
            .from("alipay_orders")
            .select("id, order_type, user_id, subject, order_data")
            .in("id", orderIds);
        if (error) throw new Error(error.message);

        ordersById = new Map((orders ?? []).map((order) => [order.id, {
            id: order.id,
            order_type: order.order_type ?? null,
            user_id: order.user_id ?? null,
            subject: order.subject ?? null,
            order_data: (order.order_data as Record<string, unknown> | null) ?? null,
        }]));
    }

    const userIds = Array.from(new Set([
        ...legacyRows.map((row) => row.student_id),
        ...pendingSettlementRows.map((row) => row.student_id),
        ...Array.from(ordersById.values()).map((order) => order.user_id),
    ].filter((id): id is string => Boolean(id))));

    let profilesByUserId = new Map<string, { nickname: string | null; full_name: string | null }>();
    if (userIds.length > 0) {
        const { data: profiles, error } = await serviceRoleSupabase
            .from("user_profiles")
            .select("user_id, nickname, full_name")
            .in("user_id", userIds);
        if (error) throw new Error(error.message);

        profilesByUserId = new Map((profiles ?? []).map((profile) => [profile.user_id, {
            nickname: profile.nickname ?? null,
            full_name: profile.full_name ?? null,
        }]));
    }

    let subscriptionRevenueFen = 0;
    let contentPurchaseRevenueFen = 0;
    const items: CoachRevenueItem[] = [];

    for (const tx of incomeRows) {
        const amountFen = Math.max(0, Math.round(Number(tx.amount ?? 0)));
        if (amountFen <= 0) continue;

        const order = tx.alipay_order_id ? ordersById.get(tx.alipay_order_id) : null;
        const type: RevenueItemType = isContentOrderType(order?.order_type) ? "content_purchase" : "subscription";

        if (type === "content_purchase") {
            contentPurchaseRevenueFen += amountFen;
        } else {
            subscriptionRevenueFen += amountFen;
        }

        if (includeItems) {
            const studentName = getDisplayName(order?.user_id ? profilesByUserId.get(order.user_id) : null) || "学员";
            items.push({
                id: tx.id,
                type,
                amount: fenToYuan(amountFen),
                description: tx.description?.trim() ||
                    (type === "content_purchase" ? order?.subject || "内容收入" : `订阅收入 - ${studentName}`),
                createdAt: tx.created_at,
                studentName,
                contentTitle: type === "content_purchase" ? order?.subject ?? undefined : undefined,
            });
        }
    }

    for (const settlement of pendingSettlementRows) {
        const amountFen = Math.max(0, Math.round(Number(settlement.coach_amount ?? 0)));
        if (amountFen <= 0) continue;

        subscriptionRevenueFen += amountFen;

        if (includeItems) {
            const order = ordersById.get(settlement.alipay_order_id);
            const studentId = settlement.student_id ?? order?.user_id ?? null;
            const studentName = getDisplayName(studentId ? profilesByUserId.get(studentId) : null) || "学员";
            items.push({
                id: settlement.id,
                type: "subscription",
                amount: fenToYuan(amountFen),
                description: `待结算订阅收入 - ${studentName}`,
                createdAt: settlement.created_at,
                studentName,
            });
        }
    }

    for (const row of legacyRows) {
        const amountFen = Math.max(0, Math.round(Number(row.monthly_price ?? 0)));
        if (amountFen <= 0) continue;

        subscriptionRevenueFen += amountFen;

        if (includeItems) {
            const revenueAt = getRevenueAt(row);
            const studentName = getDisplayName(row.student_id ? profilesByUserId.get(row.student_id) : null) || "未知学员";
            items.push({
                id: row.id,
                type: "subscription",
                amount: fenToYuan(amountFen),
                description: `订阅月费 - ${studentName}`,
                createdAt: revenueAt?.raw ?? monthStart.toISOString(),
                studentName,
            });
        }
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const subscriptionRevenue = fenToYuan(subscriptionRevenueFen);
    const contentPurchaseRevenue = fenToYuan(contentPurchaseRevenueFen);

    return {
        subscriptionRevenue,
        contentPurchaseRevenue,
        totalRevenue: subscriptionRevenue + contentPurchaseRevenue,
        items,
    };
}
