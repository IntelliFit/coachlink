// POST /api/subscription/check-expired-subscriptions
export interface CheckExpiredSubscriptionsDto {
    // 无需参数，检查所有活跃订阅
}

export interface CheckExpiredSubscriptionsResponseDto {
    expiredCount: number;
    refreshedCount: number;
    expiredSubscriptionIds: string[];
}
