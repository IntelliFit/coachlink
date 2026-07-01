import type { Json } from '@/types/database.types';

export type AdminFeedbackCategory = 'bug' | 'suggestion' | 'experience' | 'other';
export type AdminFeedbackStatus = 'open' | 'resolved' | 'closed';

export interface AdminFeedbackItem {
    id: string;
    user_id: string;
    category: AdminFeedbackCategory;
    content: string;
    contact: string;
    page_path: string;
    app_version: string;
    client_info: Json;
    recent_requests: Json;
    image_urls: string[];
    submit_trace_id: string;
    submit_request_id: string;
    submit_host_name: string;
    status: AdminFeedbackStatus;
    resolution_message: string;
    reward_credits: number;
    handled_by: string | null;
    handled_at: string | null;
    related_question: string | null;
    created_at: string | null;
    updated_at: string | null;
    user_nickname: string | null;
    user_full_name: string | null;
    user_avatar_url: string | null;
    user_phone: string | null;
    user_email: string | null;
    user_primary_role: string | null;
    user_is_coach: boolean | null;
}

export interface ListAdminFeedbackResponseDto {
    items: AdminFeedbackItem[];
    total: number;
    page: number;
    limit: number;
    stats: {
        open: number;
        resolved: number;
        closed: number;
    };
}

export interface UpdateAdminFeedbackStatusDto {
    status: AdminFeedbackStatus;
    resolution_message?: string;
    reward_credits?: number;
}

export interface UpdateAdminFeedbackStatusResponseDto {
    item: AdminFeedbackItem;
}
