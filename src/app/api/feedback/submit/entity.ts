export type FeedbackCategory = 'bug' | 'suggestion' | 'experience' | 'other';

export interface RecentRequestTraceDto {
    id?: string;
    method?: string;
    url?: string;
    status?: number | string | null;
    success?: boolean;
    duration_ms?: number | null;
    started_at?: string;
    request_id?: string;
    trace_id?: string;
    message?: string;
}

export interface SubmitFeedbackDto {
    content: string;
    relatedQuestion?: string;
    category?: FeedbackCategory;
    contact?: string;
    page_path?: string;
    app_version?: string;
    client_info?: Record<string, unknown>;
    recent_requests?: RecentRequestTraceDto[];
    image_urls?: string[];
}

export interface SubmitFeedbackResponseDto {
    success: boolean;
    message: string;
    feedbackId?: string;
    id?: string;
}
