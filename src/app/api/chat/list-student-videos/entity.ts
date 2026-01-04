import type { VideoReferenceItem } from "../send-message/entity";

export interface ListStudentVideosDto {
    studentId: string; // 学员ID
    query?: string; // 搜索关键词
    onlyProgress?: boolean; // 只看进步视频
    page?: number;
    pageSize?: number;
}

export interface VideoItem extends Omit<VideoReferenceItem, "videoId"> {
    id: string;
}

export interface ListStudentVideosResponseDto {
    success: boolean;
    message?: string;
    data: {
        videos: VideoItem[];
        hasMore: boolean;
        total: number;
    } | null;
}
