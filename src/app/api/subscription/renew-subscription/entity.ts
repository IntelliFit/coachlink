import { CoachSubscriptionRow } from "@/types";

// 续费请求参数
export interface RenewSubscriptionDto {
    // 要续费的订阅ID
    subscriptionId: string;

    // 续费类型：extend = 延长当前计划
    renewType: "extend";

    // 增加的训练周数
    additionalWeeks: number;

    // 支付金额
    amount: number;

    // 支付订单ID（可选）
    orderId?: string;
}

// 返回参数
export interface RenewSubscriptionResponseDto {
    subscription: CoachSubscriptionRow;
}
