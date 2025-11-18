// 获取用户视频列表请求和响应的类型定义
import { TrainingVideo, VideoFilters } from '@/types/video';

export type { TrainingVideo, VideoFilters };

export interface GetUserVideosDto {
    userId?: string; // 可选：教练查看学员视频时传入学员ID
    filters?: VideoFilters;
    pagination?: { page: number; limit: number };
}

export interface GetUserVideosResponseDto {
    videos: TrainingVideo[];
    total: number;
}