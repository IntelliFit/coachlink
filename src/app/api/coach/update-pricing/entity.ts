export interface UpdatePricingDto {
    coach_id: string;          // 教练ID
    ai_monthly: number;        // AI版月价格
    premium_monthly: number;   // 高级版月价格
}

export interface UpdatePricingResponseDto {
    success: boolean;
}