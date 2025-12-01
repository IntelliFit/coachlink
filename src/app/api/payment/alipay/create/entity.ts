// 请求参数的接口类型
export interface CreateAlipayOrderDto {
    out_trade_no: string;
    subject: string;
    total_amount: number;
    order_type?: string;
    order_data?: any;
    qr_pay_mode?: string;
}

// 返回参数的接口类型
export interface CreateAlipayOrderResponseDto {
    order: {
        id: string;
        out_trade_no: string;
        subject: string;
        total_amount: number;
        status: string;
        payment_url: string;
        created_at: string;
    };
    paymentInfo: {
        paymentUrl: string;
        paymentMethod: string;
        qrPayMode: string;
        qrcodeWidth: string;
        description: string;
        iframeMode: boolean;
        iframeSize: {
            minWidth: number;
            minHeight: number;
            recommendedWidth: number;
            recommendedHeight: number;
        };
    };
}