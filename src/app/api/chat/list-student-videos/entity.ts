import type { VideoReferenceItem } from "../send-message/entity";

export interface ListStudentVideosDto {
    // 学员ID
    studentId?: string;

    // 搜索关键词
    query?: string;

    // 只看进步视频
    onlyProgress?: boolean;
    
    page?: number;
    pageSize?: number;
}

export interface VideoItem extends Omit<VideoReferenceItem, "videoId"> {
    id: string;
}

export interface ListStudentVideosResponseDto {
    videos: VideoItem[];
    hasMore: boolean;
    total: number;
}
