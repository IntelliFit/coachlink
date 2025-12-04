// 请求参数的接口类型
export interface GetCoachReviewsDto {
    subscriptionId: string;
}

// 返回参数的接口类型
export interface GetCoachReviewsResponseDto {
    reviews: CoachReviewRow[];
}

// 教练评价行类型
import type { CoachReviewRow } from '@/types';