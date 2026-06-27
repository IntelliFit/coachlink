import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { serviceRoleSupabase } from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { AdminFeedbackCategory, AdminFeedbackStatus, ListAdminFeedbackResponseDto } from './entity';
import { enrichFeedbackRows, type FeedbackRow } from './feedbackAdminHelpers';

const CATEGORIES = new Set<AdminFeedbackCategory>(['bug', 'suggestion', 'experience', 'other']);
const STATUSES = new Set<AdminFeedbackStatus>(['open', 'resolved', 'closed']);

function requireAdmin(session: Awaited<ReturnType<typeof getServerSession>>) {
    if (!session?.user?.id) return { ok: false as const, status: 401, message: '未登录' };
    if (!(session.user as { is_admin?: boolean })?.is_admin) {
        return { ok: false as const, status: 403, message: '无权限' };
    }
    return { ok: true as const };
}

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function escapeSearch(value: string) {
    return value.replace(/[,%]/g, ' ').replace(/_/g, ' ').trim();
}

async function statusCount(status: AdminFeedbackStatus) {
    let query = serviceRoleSupabase
        .from('feedbacks')
        .select('id', { count: 'exact', head: true });
    query = status === 'open' ? query.in('status', ['open', 'pending']) : query.eq('status', status);
    const { count, error } = await query;
    if (error) {
        console.error('[admin/feedback] stats error:', error);
        return 0;
    }
    return count ?? 0;
}

export async function GET(req: Request) {
    const session = await getServerSession();
    const auth = requireAdmin(session);
    if (!auth.ok) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: auth.message, data: null },
            { status: auth.status },
        );
    }

    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20));
    const offset = (page - 1) * limit;
    const search = (url.searchParams.get('q') || '').trim();
    const category = (url.searchParams.get('category') || '').trim() as AdminFeedbackCategory | 'all' | '';
    const status = (url.searchParams.get('status') || 'open').trim() as AdminFeedbackStatus | 'all' | '';

    let query = serviceRoleSupabase
        .from('feedbacks')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (category && category !== 'all' && CATEGORIES.has(category)) {
        query = query.eq('category', category);
    }
    if (status && status !== 'all' && STATUSES.has(status)) {
        query = status === 'open' ? query.in('status', ['open', 'pending']) : query.eq('status', status);
    }
    if (search) {
        const escaped = escapeSearch(search);
        const filters = [
            `content.ilike.%${escaped}%`,
            `contact.ilike.%${escaped}%`,
            `page_path.ilike.%${escaped}%`,
            `app_version.ilike.%${escaped}%`,
            `submit_trace_id.ilike.%${escaped}%`,
            `submit_request_id.ilike.%${escaped}%`,
            `related_question.ilike.%${escaped}%`,
        ];
        if (isUuid(search)) {
            filters.push(`id.eq.${search}`, `user_id.eq.${search}`);
        }
        query = query.or(filters.join(','));
    }

    const [{ data, error, count }, open, resolved, closed] = await Promise.all([
        query,
        statusCount('open'),
        statusCount('resolved'),
        statusCount('closed'),
    ]);

    if (error) {
        console.error('[admin/feedback] list error:', error);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: error.message, data: null },
            { status: 500 },
        );
    }

    const items = await enrichFeedbackRows((data || []) as FeedbackRow[]);
    return NextResponse.json<ApiData<ListAdminFeedbackResponseDto>>({
        success: true,
        message: 'ok',
        data: {
            items,
            total: count ?? 0,
            page,
            limit,
            stats: { open, resolved, closed },
        },
    });
}
