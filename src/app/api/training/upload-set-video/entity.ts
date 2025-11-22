// 上传组视频的请求和响应类型定义

export interface UploadSetVideoDto {
    training_record_id: string;
    exercise_index: number;
    set_index: number;
    video_url: string; // 视频URL（可以是外部链接，如抖音、B站等）
    thumbnail_url?: string; // 缩略图URL（可选）
    duration_seconds?: number; // 视频时长（秒）
    file_size_bytes?: number; // 文件大小（字节）
}

export interface UploadSetVideoResponseDto {
    success: boolean;
    data?: {
        id: string;
        training_record_id: string;
        exercise_index: number;
        set_index: number;
        video_url: string;
        thumbnail_url?: string;
        duration_seconds?: number;
        file_size_bytes?: number;
        upload_status: string;
        created_at: string;
    };
    message?: string;
}

