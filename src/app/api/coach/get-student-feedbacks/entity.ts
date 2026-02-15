// 请求参数的接口类型
export interface GetStudentFeedbacksDto {
    /** 计划实例 ID */
    instanceId: string;
    /** 是否同时标记为已读 */
    markRead?: boolean;
}

export interface FeedbackItem {
    id: string;
    execution_id: string;
    day_index: number;
    content: string;
    difficulty_rating: number | null;
    coach_read_at: string | null;
    created_at: string;
}

// 返回参数的接口类型
export interface GetStudentFeedbacksResponseDto {
    feedbacks: FeedbackItem[];
    unread_count: number;
}

