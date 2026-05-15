export interface ListPaymentOrdersDto {
    page?: number;
    limit?: number;
    status?: 'pending' | 'paid' | 'closed' | 'failed' | 'refunded';
    orderType?: string; // subscription | subscription_renew | coach_subscription | coach_subscription_renew | student_membership
}

export interface PaymentOrderSettlementStatus {
    status: 'pending' | 'processing' | 'split_success' | 'split_failed' | 'wallet_credited';
    error_message: string | null;
    attempts: number | null;
    last_attempt_at: string | null;
    updated_at: string | null;
}

export interface PaymentOrderRow {
    id: string;
    user_id: string;
    subject: string;
    total_amount: number;
    status: string;
    order_type: string | null;
    order_data: Record<string, unknown> | null;
    payment_provider: string | null;
    trade_status: string | null;
    alipay_trade_no: string | null;
    created_at: string;
    updated_at: string;
}

export interface PaymentOrderWithUser extends PaymentOrderRow {
    user_nickname?: string | null;
    user_full_name?: string | null;
    settlement?: PaymentOrderSettlementStatus | null;
}

export interface ListPaymentOrdersResponseDto {
    orders: PaymentOrderWithUser[];
    total: number;
    page: number;
    limit: number;
}
