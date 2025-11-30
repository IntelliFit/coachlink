// 请求参数的接口类型
export interface CreatePaymentDto {
    amount: number;
    currency: string;
    orderId: string;
    description?: string;
    returnUrl?: string;
    cancelUrl?: string;
}

// 返回参数的接口类型
export interface CreatePaymentResponseDto {
    paymentId: string;
    status: 'pending' | 'success' | 'failed';
    redirectUrl?: string;
    qrCodeUrl?: string; // 添加二维码链接字段
}