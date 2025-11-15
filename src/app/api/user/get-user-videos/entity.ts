// 获取用户视频列表请求和响应的类型定义
import { TrainingVideo, VideoFilters } from '@/types/video';

export type { TrainingVideo, VideoFilters };

export interface GetUserVideosDto {
    filters?: VideoFilters;
    pagination?: { page: number; limit: number };
}

export interface GetUserVideosResponseDto {
    videos: TrainingVideo[];
    total: number;
}