// 请求参数的接口类型
export interface GetPaymentDto {
    paymentId: string;
}

// 返回参数的接口类型
export interface GetPaymentResponseDto {
    paymentId: string;
    amount: number;
    currency: string;
    orderId: string;
    description?: string;
    status: 'pending' | 'success' | 'failed';
    qrCodeUrl?: string;
    createdAt: string;
}