export interface RefundAlipayOrderDto {
    /** 支付宝平台订单 id（alipay_orders.id，即 out_trade_no） */
    orderId: string;
    /** 退款原因（可选，传给支付宝） */
    refundReason?: string;
}

export interface RefundAlipayOrderResponseDto {
    success: boolean;
    message: string;
}
