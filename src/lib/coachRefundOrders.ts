import type { CoachRefundOrder, CoachRefundOrderRole } from "@coachlink/core/src/coachRefund";
import { isFirstPurchaseOrderType, shouldCancelSubscriptionOnRefund, type RefundSubscriptionRow } from "@/lib/subscriptionRefund";

export const COACH_SUBSCRIPTION_ORDER_TYPES = [
    "subscription",
    "subscription_renew",
    "coach_subscription",
    "coach_subscription_renew",
] as const;

/** WeChat virtual payment can only be refunded in the virtual-payment merchant console; the refund route rejects it. */
const NON_REFUNDABLE_PROVIDERS = new Set(["wechat_xpay"]);

export interface RefundOrderRow {
    id: string;
    status: string | null;
    total_amount: number | string | null;
    order_type: string | null;
    payment_provider: string | null;
    created_at: string | null;
    order_data: Record<string, unknown> | null;
}

function orderSubscriptionId(order: RefundOrderRow): string {
    const data = order.order_data || {};
    return String(data.subscriptionId || data.subscription_id || "").trim();
}

function isLinkedToSubscription(
    order: RefundOrderRow,
    subscription: RefundSubscriptionRow,
    subscriptionOrderIds: ReadonlySet<string>,
): boolean {
    const linkedId = orderSubscriptionId(order);
    if (linkedId) return linkedId === subscription.id;
    // Web first purchases carry only the coach_subscription_orders id until it is paid.
    const subscriptionOrderId = String(order.order_data?.subscriptionOrderId || "").trim();
    if (subscriptionOrderId && subscriptionOrderIds.has(subscriptionOrderId)) return true;
    return order.id === subscription.order_id || order.id === subscription.last_payment_order_id;
}

function roleOf(
    order: RefundOrderRow,
    subscription: RefundSubscriptionRow,
    appliedId: string | null,
    cancels: boolean,
): CoachRefundOrderRole {
    // An order_id-only row that never activated (inactive / pending) is not "in use".
    if (order.id === appliedId && cancels) return "in_use";
    if (!isFirstPurchaseOrderType(order.order_type)) return "renewal";
    // A duplicate needs another payment the subscription actually runs on.
    const appliedElsewhere = Boolean(subscription.last_payment_order_id) && subscription.last_payment_order_id !== order.id;
    return !cancels && appliedElsewhere ? "duplicate" : "other";
}

/**
 * The paid orders of one subscription that this coach may refund, newest first,
 * with the same subscription consequence the refund route applies. Only orders
 * the refund route accepts are listed: paid, a subscription payment, the
 * coach's own (order_data.coachId) and not WeChat virtual payment.
 */
export function classifyCoachRefundOrders(input: {
    coachId: string;
    subscription: RefundSubscriptionRow;
    /** Paid subscription orders, plus the subscription's applied order whatever its status. */
    orders: RefundOrderRow[];
    /** coach_subscription_orders ids recorded against this subscription (Web checkouts). */
    subscriptionOrderIds?: readonly string[];
}): CoachRefundOrder[] {
    const { coachId, subscription, orders } = input;
    const subscriptionOrderIds = new Set(input.subscriptionOrderIds || []);
    const refundable = orders.filter((order) =>
        order.status === "paid"
        && (COACH_SUBSCRIPTION_ORDER_TYPES as readonly string[]).includes(String(order.order_type || ""))
        && !NON_REFUNDABLE_PROVIDERS.has(String(order.payment_provider || ""))
        && String(order.order_data?.coachId || "").trim() === coachId
        && Math.round(Number(order.total_amount)) > 0
        && isLinkedToSubscription(order, subscription, subscriptionOrderIds),
    );
    const appliedId = subscription.last_payment_order_id || subscription.order_id || null;
    const appliedOrderType = orders.find((order) => order.id === subscription.last_payment_order_id)?.order_type;

    return refundable
        .map((order) => {
            const cancels = shouldCancelSubscriptionOnRefund({
                orderId: order.id,
                orderType: order.order_type,
                subscription,
                appliedOrderType,
            });
            return {
                id: order.id,
                amountFen: Math.round(Number(order.total_amount)),
                orderType: String(order.order_type || ""),
                paymentProvider: order.payment_provider || null,
                createdAt: order.created_at || null,
                role: roleOf(order, subscription, appliedId, cancels),
                cancelsSubscription: cancels,
            };
        })
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}
