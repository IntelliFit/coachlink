export interface RefundSubscriptionRow {
    id: string;
    status?: string | null;
    order_id?: string | null;
    last_payment_order_id?: string | null;
}

const FIRST_PURCHASE_ORDER_TYPES = new Set(["subscription", "coach_subscription"]);
const UNPAID_SUBSCRIPTION_STATUSES = new Set(["inactive", "pending_payment", "waiting"]);

export function isFirstPurchaseOrderType(orderType: unknown): boolean {
    return FIRST_PURCHASE_ORDER_TYPES.has(String(orderType || ""));
}

/**
 * Whether refunding a coach-subscription payment cancels the subscription.
 *
 * A refunded first purchase leaves the subscription alone when it never ran on
 * that payment: a mini-program duplicate charge while another mini-program
 * first purchase activated the row (those activations add no weeks), or a
 * charge that never activated anything. When a renewal or a Web purchase (which
 * can stack weeks) is applied, or the applied payment's type is unknown, the
 * existing rule (cancel) applies. Renewal refunds keep the existing rule.
 */
export function shouldCancelSubscriptionOnRefund(input: {
    orderId: string;
    orderType: unknown;
    subscription: RefundSubscriptionRow;
    /** order_type of the order in subscription.last_payment_order_id, when it is another order. */
    appliedOrderType?: unknown;
}): boolean {
    const { orderId, orderType, subscription, appliedOrderType } = input;
    if (!isFirstPurchaseOrderType(orderType)) return true;
    const applied = subscription.last_payment_order_id;
    if (applied) {
        if (applied === orderId) return true;
        return !(orderType === "coach_subscription" && appliedOrderType === "coach_subscription");
    }
    // Rows activated before last_payment_order_id existed carry only order_id.
    return subscription.order_id === orderId && !UNPAID_SUBSCRIPTION_STATUSES.has(String(subscription.status || ""));
}
