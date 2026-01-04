import { CoachLinkTable, CoachSubscriptionRow } from "@/types";

// 请求参数的接口类型，使用数据库表的Update类型
export type UpdateSubscriptionDto =
    & CoachLinkTable["coach_subscriptions"]["Update"]
    & {
        id: string; // 必须提供订阅ID才能更新
        // Extended product fields (may not be in base type yet)
        product_id?: string | null;
        product_name?: string | null;
        product_tier?: string | null;
        subscribed_weeks?: number | null;
        prior_training_weeks?: number | null; // 学员迁入平台前已跟随教练训练的周数
    };

// 返回参数的接口类型
export interface UpdateSubscriptionResponseDto {
    subscription: CoachSubscriptionRow;
}
