import { serviceRoleSupabase } from '@/lib/supabaseClient';
import type { Database, Json } from '@/types/database.types';
import type { AdminFeedbackCategory, AdminFeedbackItem, AdminFeedbackStatus } from './entity';

export type FeedbackRow = Database['public']['Tables']['feedbacks']['Row'];

const CATEGORIES = new Set<AdminFeedbackCategory>(['bug', 'suggestion', 'experience', 'other']);
const STATUSES = new Set<AdminFeedbackStatus>(['open', 'resolved', 'closed']);

function normalizeCategory(value: string | null | undefined): AdminFeedbackCategory {
    return CATEGORIES.has(value as AdminFeedbackCategory) ? value as AdminFeedbackCategory : 'other';
}

function normalizeStatus(value: string | null | undefined): AdminFeedbackStatus {
    return STATUSES.has(value as AdminFeedbackStatus) ? value as AdminFeedbackStatus : 'open';
}

function jsonArrayOfStrings(value: Json): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export async function enrichFeedbackRows(rows: FeedbackRow[]): Promise<AdminFeedbackItem[]> {
    if (rows.length === 0) return [];

    const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
    const [profilesResult, usersResult] = await Promise.all([
        userIds.length
            ? serviceRoleSupabase
                .from('user_profiles')
                .select('user_id, nickname, full_name, avatar_url, phone')
                .in('user_id', userIds)
            : Promise.resolve({ data: [] as any[], error: null }),
        userIds.length
            ? serviceRoleSupabase
                .from('users')
                .select('id, phone, email, primary_role, is_coach')
                .in('id', userIds)
            : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    if (profilesResult.error) console.error('[admin/feedback] profile enrich error:', profilesResult.error);
    if (usersResult.error) console.error('[admin/feedback] user enrich error:', usersResult.error);

    const profileMap = new Map(
        (profilesResult.data || []).map((profile: any) => [String(profile.user_id), profile]),
    );
    const userMap = new Map(
        (usersResult.data || []).map((user: any) => [String(user.id), user]),
    );

    return rows.map((row) => {
        const profile = profileMap.get(row.user_id);
        const user = userMap.get(row.user_id);
        return {
            id: row.id,
            user_id: row.user_id,
            category: normalizeCategory(row.category),
            content: row.content,
            contact: row.contact || '',
            page_path: row.page_path || '',
            app_version: row.app_version || '',
            client_info: row.client_info || {},
            recent_requests: row.recent_requests || [],
            image_urls: jsonArrayOfStrings(row.image_urls),
            submit_trace_id: row.submit_trace_id || '',
            submit_request_id: row.submit_request_id || '',
            submit_host_name: row.submit_host_name || '',
            status: normalizeStatus(row.status),
            resolution_message: row.resolution_message || '',
            reward_credits: row.reward_credits || 0,
            handled_by: row.handled_by || null,
            handled_at: row.handled_at || null,
            related_question: row.related_question || null,
            created_at: row.created_at,
            updated_at: row.updated_at,
            user_nickname: profile?.nickname || null,
            user_full_name: profile?.full_name || null,
            user_avatar_url: profile?.avatar_url || null,
            user_phone: profile?.phone || user?.phone || null,
            user_email: user?.email || null,
            user_primary_role: user?.primary_role || null,
            user_is_coach: typeof user?.is_coach === 'boolean' ? user.is_coach : null,
        };
    });
}
