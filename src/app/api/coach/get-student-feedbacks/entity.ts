/** 单条学员训练反馈（来自 execution_feedbacks 或兼容结构） */
export interface FeedbackItem {
    day_index: number;
    content: string | null;
    difficulty_rating?: number | null;
    created_at?: string;
    instance_id?: string;
}

export interface GetStudentFeedbacksDto {
    instanceId: string;
    markRead?: boolean;
}

export interface GetStudentFeedbacksResponseDto {
    feedbacks: FeedbackItem[];
    unread_count: number;
}
