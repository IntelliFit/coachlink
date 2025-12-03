// 请求参数的接口类型
export interface CreateAlipayOrderDto {
    subject: string;
    totalAmount: number;
    orderType?: string;
    orderData?: any;
    createMode?: string;
}

// 返回参数的接口类型
export interface CreateAlipayOrderResponseDto {
    order: {
        id: string;
        out_trade_no: string;
        subject: string;
        total_amount: number;
        status: string;
        created_at: string;
    };
    paymentInfo: {
        formHtml: string;
        description: string;
    };
}