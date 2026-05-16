export interface ListPaymentOrdersDto {
    page?: number;
    limit?: number;
    status?: 'pending' | 'paid' | 'cancelled' | 'refunded';
    orderType?: string; // subscription | subscription_renew | student_membership
}

export interface PaymentOrderRow {
    id: string;
    user_id: string;
    subject: string;
    total_amount: number;
    status: string;
    order_type: string | null;
    order_data: Record<string, unknown> | null;
    alipay_trade_no: string | null;
    created_at: string;
    updated_at: string;
}

export interface PaymentOrderWithUser extends PaymentOrderRow {
    user_nickname?: string | null;
    user_full_name?: string | null;
}

export interface ListPaymentOrdersResponseDto {
    orders: PaymentOrderWithUser[];
    total: number;
    page: number;
    limit: number;
}
