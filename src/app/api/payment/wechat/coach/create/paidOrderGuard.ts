import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { formatHuifuReqDate } from "@/lib/huifuMiniProgramPay";
import { assertHuifuWebPaymentAmount, queryHuifuPaymentOrder } from "@/lib/huifuWebPayment";
import { fulfillSubscriptionAndMaybeCreditWallet } from "@/app/api/payment/alipay/fulfillPaidOrder";
import {
    ALREADY_SUBSCRIBED_MESSAGE,
    PAID_NOT_ACTIVATED_MESSAGE,
    PAID_ORDER_LOOKBACK_MS,
    PAID_PACKAGE_CHANGED_MESSAGE,
    PAYMENT_STATUS_UNKNOWN_MESSAGE,
    findUnappliedPaidOrders,
    isRunningSubscription,
    paidOrderMatchesSubscription,
    selectPendingOrdersToRecheck,
    type CheckoutSubscription,
} from "@/lib/coachCheckoutGuard";

type OrderRow = Record<string, any> & { id: string; status: string; created_at: string };

export type FirstPurchaseGuardResult =
    | { blocked: false }
    | { blocked: true; status: number; message: string; paidOrderId?: string };

/** Marks a pending order paid when Huifu reports success; returns the paid row, or null. */
async function markPaidIfHuifuSucceeded(order: OrderRow): Promise<OrderRow | null> {
    const orderData = (order.order_data || {}) as Record<string, any>;
    try {
        const result = await queryHuifuPaymentOrder(order as any, {
            orgReqDate: String(orderData.huifu_req_date || formatHuifuReqDate(new Date(order.created_at))),
            orgReqSeqId: order.id,
        });
        if (result.trans_stat !== "S") return null;
        assertHuifuWebPaymentAmount(order as any, result);
        const { data: updated } = await (serviceRoleSupabase.from("alipay_orders") as any)
            .update({
                status: "paid",
                trade_status: "S",
                alipay_trade_no: result.org_hf_seq_id || null,
                payment_provider: "wechat",
                updated_at: new Date().toISOString(),
            })
            .eq("id", order.id)
            .eq("status", "pending")
            .select()
            .maybeSingle();
        return (updated as OrderRow | null) || { ...order, status: "paid" };
    } catch (error) {
        // An unpaid or cancelled attempt can fail the query; that must not block a new purchase.
        console.warn("[Huifu Wechat Coach Create] pending order recheck failed:", order.id, error);
        return null;
    }
}

/**
 * Before a first purchase creates another order: refuse while a running
 * subscription exists, and while an earlier payment for this subscription is
 * paid (or turns out paid at Huifu) but not yet activated. In that case retry
 * the activation instead of charging again.
 */
export async function guardFirstPurchaseCheckout(params: {
    userId: string;
    subscriptionId: string;
    subscription: CheckoutSubscription;
}): Promise<FirstPurchaseGuardResult> {
    const { userId, subscriptionId, subscription } = params;
    if (isRunningSubscription(subscription.status)) {
        return { blocked: true, status: 409, message: ALREADY_SUBSCRIBED_MESSAGE };
    }

    const { data, error } = await (serviceRoleSupabase.from("alipay_orders") as any)
        .select("*")
        .eq("user_id", userId)
        .eq("order_type", "coach_subscription")
        .eq("order_data->>subscriptionId", subscriptionId)
        .in("status", ["paid", "pending"])
        .gte("created_at", new Date(Date.now() - PAID_ORDER_LOOKBACK_MS).toISOString())
        .order("created_at", { ascending: false })
        .limit(20);
    if (error) {
        console.error("[Huifu Wechat Coach Create] read earlier orders failed:", error);
        return { blocked: true, status: 503, message: PAYMENT_STATUS_UNKNOWN_MESSAGE };
    }

    let orders = (data || []) as OrderRow[];
    for (const pending of selectPendingOrdersToRecheck(orders)) {
        const paid = await markPaidIfHuifuSucceeded(pending);
        if (paid) orders = orders.map((order) => (order.id === paid.id ? paid : order));
    }

    const [unapplied] = findUnappliedPaidOrders(subscription, orders);
    if (!unapplied) return { blocked: false };

    if (!paidOrderMatchesSubscription(unapplied, subscription)) {
        // The student picked another package after paying; activating now would grant the wrong one.
        console.error("[Huifu Wechat Coach Create] paid order does not match the current package, needs manual activation:", unapplied.id, subscriptionId);
        return { blocked: true, status: 409, message: PAID_PACKAGE_CHANGED_MESSAGE, paidOrderId: unapplied.id };
    }

    try {
        await fulfillSubscriptionAndMaybeCreditWallet(unapplied, userId, "wechat");
    } catch (fulfillError) {
        console.error("[Huifu Wechat Coach Create] activation retry failed:", unapplied.id, fulfillError);
    }
    return { blocked: true, status: 409, message: PAID_NOT_ACTIVATED_MESSAGE, paidOrderId: unapplied.id };
}
