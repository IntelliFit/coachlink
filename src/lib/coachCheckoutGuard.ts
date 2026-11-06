/**
 * Decisions for a first coach purchase, before a new payment order is created.
 * A paid order whose activation has not landed must never lead to a second charge.
 */

export const PAID_NOT_ACTIVATED_MESSAGE = "这笔订阅已支付成功，正在为你开通，请勿重复支付";
export const PAID_PACKAGE_CHANGED_MESSAGE = "你之前的一笔订阅已支付成功，但和现在选的方案不同，请联系教练或客服开通，请勿重复支付";
export const ALREADY_SUBSCRIBED_MESSAGE = "你已订阅该教练，延长订阅请点击【续费】";
export const PAYMENT_STATUS_UNKNOWN_MESSAGE = "暂时无法确认上一笔支付的状态，请稍后重试";

/** Paid first purchases this recent that the subscription has not recorded count as still activating. */
export const PAID_ORDER_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
/** Pending first purchases this recent are checked with Huifu before a new order is created. */
export const PENDING_RECHECK_WINDOW_MS = 30 * 60 * 1000;
export const PENDING_RECHECK_LIMIT = 3;

const RUNNING_STATUSES = new Set(["active", "near_expiry"]);
const UNPAID_STATUSES = new Set(["inactive", "pending_payment"]);

export interface CheckoutSubscription {
    status?: string | null;
    last_payment_order_id?: string | null;
    payment_confirmed_at?: string | null;
    monthly_price?: number | string | null;
    product_id?: string | null;
    subscribed_weeks?: number | null;
}

export interface CheckoutOrder {
    id: string;
    status?: string | null;
    created_at: string;
    total_amount?: number | string | null;
    order_data?: unknown;
}

/**
 * First-purchase activation records the payment but keeps the package fields
 * already on the row, and choosing a package again rewrites those fields. Only
 * activate a paid order for the package the row still holds, so nobody gets
 * more or fewer weeks than they paid for.
 */
export function paidOrderMatchesSubscription(order: CheckoutOrder, subscription: CheckoutSubscription): boolean {
    const data = (order.order_data && typeof order.order_data === "object" ? order.order_data : {}) as Record<string, unknown>;
    const paidFen = Math.round(Number(order.total_amount));
    const priceFen = Math.round(Number(subscription.monthly_price));
    if (!Number.isFinite(paidFen) || paidFen <= 0 || paidFen !== priceFen) return false;
    if (String(data.productId || "") !== String(subscription.product_id || "")) return false;
    // The order stores the months derived from the row's weeks when it was created.
    const rowMonths = Math.max(1, Math.round(Number(subscription.subscribed_weeks || 0) / 4));
    return Number(data.durationMonths) === rowMonths;
}

/** A running subscription is extended by renewal; a first purchase would charge without adding weeks. */
export function isRunningSubscription(status: string | null | undefined): boolean {
    return RUNNING_STATUSES.has(String(status || ""));
}

/**
 * A weapp first purchase that arrives while the subscription already runs on
 * another payment is a second charge for the same thing. It must not take the
 * row over or be settled to the coach; it stays paid until it is refunded.
 */
export function isDuplicateFirstPurchase(
    orderType: string | null | undefined,
    orderId: string,
    subscription: Pick<CheckoutSubscription, "status" | "last_payment_order_id">,
): boolean {
    const applied = subscription.last_payment_order_id;
    return orderType === "coach_subscription"
        && Boolean(applied)
        && applied !== orderId
        && isRunningSubscription(subscription.status);
}

/** Paid first purchases the subscription has not recorded yet, oldest first. */
export function findUnappliedPaidOrders<T extends CheckoutOrder>(
    subscription: CheckoutSubscription,
    orders: readonly T[],
    nowMs: number = Date.now(),
): T[] {
    if (!UNPAID_STATUSES.has(String(subscription.status || ""))) return [];
    const confirmedMs = Date.parse(String(subscription.payment_confirmed_at || ""));
    return orders
        .filter((order) => {
            if (order.status !== "paid" || order.id === subscription.last_payment_order_id) return false;
            const createdMs = Date.parse(order.created_at);
            if (!Number.isFinite(createdMs) || nowMs - createdMs >= PAID_ORDER_LOOKBACK_MS) return false;
            // Orders older than the last confirmed payment belong to an earlier period.
            return !Number.isFinite(confirmedMs) || createdMs > confirmedMs;
        })
        .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}

/** Recent pending first purchases to re-check with Huifu, newest first. */
export function selectPendingOrdersToRecheck<T extends CheckoutOrder>(
    orders: readonly T[],
    nowMs: number = Date.now(),
): T[] {
    return orders
        .filter((order) => {
            const createdMs = Date.parse(order.created_at);
            return order.status === "pending" && Number.isFinite(createdMs) && nowMs - createdMs < PENDING_RECHECK_WINDOW_MS;
        })
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .slice(0, PENDING_RECHECK_LIMIT);
}
