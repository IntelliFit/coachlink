/** 单条学员训练反馈（来自 execution_feedbacks） */
export interface FeedbackItem {
    id: string;
    execution_id: string;
    day_index: number;
    content: string | null;
    difficulty_rating: number | null;
    coach_read_at: string | null;
    created_at: string;
    instance_id?: string;
}

export interface GetStudentFeedbacksDto {
    /** 计划实例 ID */
    instanceId: string;
    /** 是否同时标记为已读 */
    markRead?: boolean;
}

export interface GetStudentFeedbacksResponseDto {
    feedbacks: FeedbackItem[];
    unread_count: number;
}
