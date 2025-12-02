// 请求参数的接口类型
export interface QueryAlipayOrderDto {
    orderId: string;
}

// 返回参数的接口类型
export interface QueryAlipayOrderResponseDto {
    order: {
        id: string;
        out_trade_no: string;
        subject: string;
        total_amount: number;
        status: string;
        trade_status: string;
        qr_code: string;
        created_at: string;
        updated_at: string;
    };
}

export type TradeStatus = 'WAIT_BUYER_PAY' | 'TRADE_CLOSED' | 'TRADE_SUCCESS' | 'TRADE_FINISHED';