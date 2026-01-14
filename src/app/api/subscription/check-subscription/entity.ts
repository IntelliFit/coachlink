export interface CheckSubscriptionDto {
  subscriptionId: string;
  reason?: string;
  immediate?: boolean; // 是否立即取消（设置结束时间为当前时间）
}

export interface CheckSubscriptionResponseDto {
  subscription: any; // CoachSubscriptionRow after importing type
}
