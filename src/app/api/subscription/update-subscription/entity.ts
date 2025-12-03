import { CoachLinkTable, CoachSubscriptionRow } from "@/types";

// 请求参数的接口类型，使用数据库表的Update类型
export type UpdateSubscriptionDto = CoachLinkTable['coach_subscriptions']['Update'] & {
    id: string; // 必须提供订阅ID才能更新
};

// 返回参数的接口类型
export interface UpdateSubscriptionResponseDto {
    subscription: CoachSubscriptionRow;
}