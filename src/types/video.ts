// 统一的视频类型定义
export type VideoType = 'baseline' | 'training' | 'completion';
export type ReviewStatus = 'pending' | 'reviewed' | 'not_required';
export type ProcessingStatus = 'uploading' | 'processing' | 'ready' | 'failed';

export interface CoachFeedback {
    rating?: number;
    comment?: string;
    tips?: string[];
    coach_name?: string;
    coach_id?: string;
    reviewed_at?: string;
}

export interface TrainingVideo {
    id: string;
    user_id: string;
    coach_id?: string;
    type: VideoType;
    training_plan_id?: string;
    training_session_id?: string;
    workout_log_id?: string;
    exercise_name?: string;
    week_number?: number;
    day_of_week?: string;
    video_url: string;
    thumbnail_url?: string;
    file_size?: number;
    duration_seconds?: number;
    requires_review: boolean;
    review_status: ReviewStatus;
    coach_feedback?: CoachFeedback;
    user_notes?: string;
    tags: string[];
    processing_status: ProcessingStatus;
    metadata?: Record<string, any>;
    created_at: string;
    updated_at: string;
    reviewed_at?: string;
    deleted_at?: string;
}

export interface VideoUploadContext {
    type: VideoType;
    training_plan_id?: string;
    training_session_id?: string;
    exercise_name?: string;
    week_number?: number;
    day_of_week?: string;
    requires_review?: boolean;
    user_notes?: string;
    coach_id?: string; // 新增：指定教练ID
}

export interface VideoFilters {
    type?: VideoType;
    review_status?: ReviewStatus;
    training_plan_id?: string;
    exercise_name?: string;
    date_from?: string;
    date_to?: string;
    requires_review?: boolean;
    coach_id?: string;
}

export interface VideoUploadProgress {
    loaded: number;
    total: number;
    percentage: number;
    phase?: 'preparing' | 'compressing' | 'uploading';
    statusText?: string;
    originalSizeBytes?: number;
    finalSizeBytes?: number;
    compressed?: boolean;
}

export interface UploadResult {
    video_url: string;
    thumbnail_url?: string;
    file_size: number;
    duration_seconds?: number;
}
