import { CoachSubscriptionRow } from "@/types";
import { TrainingItem } from "@/types/questionnaires";

// 请求参数的接口类型
export interface CreateSubscriptionDto {
    // 订阅的教练的编号
    coachId: string;

    // 订阅的套餐的编号
    tier?: number;

    // 订阅的订单的编号
    orderId?: string;

    // 订阅的订单的价格
    monthlyPrice?: number;

    // 当前状态
    status?: string;

    // subscribeData
    subscribeData?: TrainingItem[];

    // === 新增产品字段 ===
    // 产品唯一标识
    productId?: string;

    // 产品显示名称
    productName?: string;

    // 产品层级 ('basic' | 'standard' | 'vip')
    productTier?: string;

    // 订阅周数
    subscribedWeeks?: number;
}

// 返回参数的接口类型
export interface CreateSubscriptionResponseDto {
    subscription: CoachSubscriptionRow;
}
