// 请求参数的接口类型
export interface CreateAlipayOrderDto {
    subject: string;
    totalAmount?: number;
    orderType?: string;
    orderData?: any;
    createMode?: string;
    isMobile?: boolean; // 是否移动端，决定使用 page.pay 还是 wap.pay
    /** 为 true 时返回支付宝跳转 URL（paymentUrl），不返回 formHtml；用于 /payment/start 等直接跳转场景 */
    returnUrlOnly?: boolean;
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
        /** 当请求 returnUrlOnly 时返回，为支付宝网关跳转 URL，可直接 location.href */
        paymentUrl?: string;
    };
}
