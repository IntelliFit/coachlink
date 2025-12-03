// 请求参数的接口类型
export interface SubscribeDto {
    // 订阅的教练的编号
    coachId: string;

    // 订阅的套餐的编号
    tier: number;

    // 订阅的订单的编号
    orderId: string;

    // 订阅的订单的价格
    monthlyPrice: number;
}

// 返回参数的接口类型
export interface SubscribeResponseDto {
    subscriptionId: string;
    message: string;
}