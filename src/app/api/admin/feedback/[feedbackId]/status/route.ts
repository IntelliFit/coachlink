import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { serviceRoleSupabase } from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { AdminFeedbackStatus, UpdateAdminFeedbackStatusDto, UpdateAdminFeedbackStatusResponseDto } from '../../entity';
import { enrichFeedbackRows, type FeedbackRow } from '../../feedbackAdminHelpers';

const STATUSES = new Set<AdminFeedbackStatus>(['open', 'resolved', 'closed']);

function requireAdmin(session: Awaited<ReturnType<typeof getServerSession>>) {
    if (!session?.user?.id) return { ok: false as const, status: 401, message: '未登录' };
    if (!(session.user as { is_admin?: boolean })?.is_admin) {
        return { ok: false as const, status: 403, message: '无权限' };
    }
    return { ok: true as const, userId: session.user.id };
}

function text(value: unknown, maxLength: number) {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, maxLength);
}

export async function PATCH(
    req: Request,
    context: { params: Promise<{ feedbackId: string }> },
) {
    const session = await getServerSession();
    const auth = requireAdmin(session);
    if (!auth.ok) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: auth.message, data: null },
            { status: auth.status },
        );
    }

    const { feedbackId } = await context.params;
    if (!feedbackId) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: '缺少反馈 ID', data: null },
            { status: 400 },
        );
    }

    const body = (await req.json().catch(() => ({}))) as UpdateAdminFeedbackStatusDto;
    const nextStatus = body.status;
    if (!STATUSES.has(nextStatus)) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: '状态无效', data: null },
            { status: 400 },
        );
    }

    const rewardCredits = Math.max(0, Math.min(99999, Math.round(Number(body.reward_credits) || 0)));
    const now = new Date().toISOString();
    const { data, error } = await serviceRoleSupabase
        .from('feedbacks')
        .update({
            status: nextStatus,
            resolution_message: text(body.resolution_message, 500),
            reward_credits: nextStatus === 'resolved' ? rewardCredits : 0,
            handled_by: auth.userId,
            handled_at: now,
            updated_at: now,
        })
        .eq('id', feedbackId)
        .select('*')
        .single();

    if (error || !data) {
        console.error('[admin/feedback/status] update error:', error);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: error?.message || '反馈不存在', data: null },
            { status: error?.code === 'PGRST116' ? 404 : 500 },
        );
    }

    const [item] = await enrichFeedbackRows([data as FeedbackRow]);
    return NextResponse.json<ApiData<UpdateAdminFeedbackStatusResponseDto>>({
        success: true,
        message: '保存成功',
        data: { item },
    });
}
