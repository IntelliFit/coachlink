// 获取教练待点评视频请求和响应的类型定义
import { TrainingVideo, ReviewStatus } from '@/types/video';

export type { TrainingVideo, ReviewStatus };

export interface GetCoachPendingReviewsDto {
    coachId: string;
    pagination?: { page: number; limit: number };
    reviewStatus?: ReviewStatus;
}

export interface GetCoachPendingReviewsResponseDto {
    videos: TrainingVideo[];
    total: number;
}