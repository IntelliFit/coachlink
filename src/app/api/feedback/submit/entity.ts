// 提交反馈请求参数类型
export interface SubmitFeedbackDto {
    content: string;
    relatedQuestion?: string;
    category?: 'bug' | 'suggestion' | 'experience' | 'other';
    contact?: string;
    pagePath?: string;
    appVersion?: string;
    clientInfo?: Record<string, unknown>;
    recentRequests?: unknown[];
    imageUrls?: string[];
}

// 提交反馈返回数据类型
export interface SubmitFeedbackResponseDto {
    success: boolean;
    message: string;
    feedbackId?: string;
}
