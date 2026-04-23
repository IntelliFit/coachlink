import type { CoachSubscriptionRow } from "@/types";
import type {
    CoachPaymentRecordRow,
    CoachSubscriptionOrderRow,
} from "@/types/subscriptionOrders";

export function mapSubscriptionOrderToPaymentRecord(
    order: CoachSubscriptionOrderRow,
): CoachPaymentRecordRow {
    return {
        id: order.id,
        record_kind: "subscription_order",
        subscription_order_id: order.id,
        subscription_id: order.subscription_id,
        student_id: order.student_id,
        coach_id: order.coach_id,
        tier: order.tier,
        monthly_price: order.amount_fen,
        subscribed_weeks: order.purchased_weeks,
        status: order.status,
        payment_method: order.payment_method,
        payment_confirmed_by: order.payment_confirmed_by,
        payment_confirmed_at: order.payment_confirmed_at,
        coach_seen_at: order.coach_seen_at,
        payment_data: order.payment_data,
        remind_coach_note: order.note,
        order_id: order.alipay_order_id,
        product_id: order.product_id,
        product_name: order.product_name,
        product_tier: order.product_tier,
        order_type: order.order_type,
        created_at: order.created_at,
        updated_at: order.updated_at,
    };
}

export function mapLegacySubscriptionToPaymentRecord(
    subscription: CoachSubscriptionRow,
): CoachPaymentRecordRow {
    return {
        id: subscription.id,
        record_kind: "legacy_subscription",
        subscription_order_id: null,
        subscription_id: subscription.id,
        student_id: subscription.student_id,
        coach_id: subscription.coach_id,
        tier: subscription.tier,
        monthly_price: subscription.monthly_price,
        subscribed_weeks: subscription.subscribed_weeks,
        status: subscription.status,
        payment_method: subscription.payment_method,
        payment_confirmed_by: subscription.payment_confirmed_by,
        payment_confirmed_at: subscription.payment_confirmed_at,
        coach_seen_at: subscription.coach_seen_at,
        payment_data: subscription.payment_data,
        remind_coach_note: subscription.remind_coach_note,
        order_id: subscription.order_id,
        product_id: subscription.product_id,
        product_name: subscription.product_name,
        product_tier: subscription.product_tier,
        order_type: null,
        created_at: subscription.created_at || subscription.payment_confirmed_at || new Date(0).toISOString(),
        updated_at: subscription.updated_at,
    };
}
