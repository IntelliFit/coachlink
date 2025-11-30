// 请求参数的接口类型
export interface CreatePaymentDto {
    amount: number;
    currency: string;
    orderId: string;
    description?: string;
    returnUrl?: string;
    cancelUrl?: string;
}

export interface VerifyPaymentDto {
    paymentId: string;
    transactionId: string;
}

export interface RefundPaymentDto {
    paymentId: string;
    amount?: number;
    reason?: string;
}

// 返回参数的接口类型
export interface CreatePaymentResponseDto {
    paymentId: string;
    status: 'pending' | 'success' | 'failed';
    redirectUrl?: string;
    qrCodeUrl?: string; // 添加二维码链接字段
}

export interface VerifyPaymentResponseDto {
    paymentId: string;
    status: 'completed' | 'pending' | 'failed';
    transactionId: string;
    amount: number;
    currency: string;
    paidAt?: string;
}

export interface RefundPaymentResponseDto {
    refundId: string;
    status: 'processed' | 'pending' | 'failed';
    amount: number;
    refundedAt?: string;
}