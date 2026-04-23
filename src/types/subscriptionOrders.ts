import type { Json } from "./database.types";

export type SubscriptionOrderType = "subscribe" | "renew";
export type SubscriptionOrderStatus =
    | "pending_payment"
    | "pending_confirmation"
    | "paid"
    | "cancelled";

export type PaymentRecordKind = "subscription_order" | "legacy_subscription";

export interface CoachSubscriptionOrderRow {
    id: string;
    student_id: string;
    coach_id: string;
    subscription_id: string | null;
    order_type: SubscriptionOrderType;
    status: SubscriptionOrderStatus;
    payment_method: string | null;
    amount_fen: number;
    tier: number;
    product_id: string | null;
    product_name: string | null;
    product_tier: string | null;
    purchased_weeks: number | null;
    subscribe_data: Json | null;
    note: string | null;
    payment_data: Json | null;
    payment_confirmed_by: string | null;
    payment_confirmed_at: string | null;
    coach_seen_at: string | null;
    alipay_order_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface CoachPaymentRecordRow {
    id: string;
    record_kind: PaymentRecordKind;
    subscription_order_id: string | null;
    subscription_id: string | null;
    student_id: string;
    coach_id: string;
    tier: number;
    monthly_price: number;
    subscribed_weeks: number | null;
    status: string | null;
    payment_method: string | null;
    payment_confirmed_by: string | null;
    payment_confirmed_at: string | null;
    coach_seen_at: string | null;
    payment_data: Json | null;
    remind_coach_note: string | null;
    order_id: string | null;
    product_id: string | null;
    product_name: string | null;
    product_tier: string | null;
    order_type: string | null;
    created_at: string;
    updated_at: string | null;
}
