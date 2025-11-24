// 获取组视频的请求和响应类型定义

export interface GetSetVideosDto {
    training_record_id: string;
}

export interface SetVideoData {
    id: string;
    training_record_id: string;
    exercise_index: number;
    set_index: number;
    video_url: string;
    thumbnail_url?: string;
    duration_seconds?: number;
    file_size_bytes?: number;
    upload_status: string;
    coach_feedback?: string;
    coach_rating?: number;
    reviewed_at?: string;
    reviewed_by?: string;
    created_at: string;
}

export interface GetSetVideosResponseDto {
    success: boolean;
    data?: SetVideoData[];
    message?: string;
}

