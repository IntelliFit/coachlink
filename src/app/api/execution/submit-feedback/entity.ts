// 请求参数的接口类型
export interface SubmitFeedbackDto {
    executionId: string;
    content: string;
    difficultyRating?: number; // 1-5
}

// 返回参数的接口类型
export interface SubmitFeedbackResponseDto {
    id: string;
    created_at: string;
}

