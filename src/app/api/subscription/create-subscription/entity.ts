import { CoachSubscriptionRow } from "@/types";
import { TrainingItem } from "@/types/questionnaires";

// 请求参数的接口类型
export interface CreateSubscriptionDto {
    // 订阅的教练的编号
    coachId: string;

    // 订阅的套餐的编号
    tier: number;

    // 订阅的订单的编号
    orderId?: string;

    // 订阅的订单的价格
    monthlyPrice: number;

    // 当前状态
    status?: string;

    // subscribeData
    subscribeData?: TrainingItem[];
}


// 返回参数的接口类型
export interface CreateSubscriptionResponseDto {
    subscription: CoachSubscriptionRow
}