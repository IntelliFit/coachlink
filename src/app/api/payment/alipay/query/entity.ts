// 请求参数的接口类型
export interface QueryAlipayOrderDto {
    order_id: string;
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