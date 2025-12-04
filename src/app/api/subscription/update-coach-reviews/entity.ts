// 请求参数的接口类型
export interface UpdateCoachReviewsDto {
    reviewId: string;
    reviewText?: string;
    mediaUrls?: string[];
}

// 返回参数的接口类型
export interface UpdateCoachReviewsResponseDto {
    review: CoachReviewRow;
}

// 教练评价行类型
import type { CoachReviewRow } from '@/types';