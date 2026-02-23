import { NextResponse } from 'next/server';
import { serviceRoleSupabase as supabase } from '@/lib/supabaseClient';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import type { ApiData } from '@/types/api';
import type { GetStudentFeedbacksDto, GetStudentFeedbacksResponseDto, FeedbackItem } from './entity';

/**
 * POST /api/coach/get-student-feedbacks
 * 教练查看某个计划实例下学员的所有训练反馈；可选标记为已读。
 */
export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<GetStudentFeedbacksResponseDto>>({
            success: false,
            message: '未登录',
            data: null,
        }, { status: 401 });
    }

    const { instanceId, markRead } = (await req.json()) as GetStudentFeedbacksDto;
    if (!instanceId) {
        return NextResponse.json<ApiData<GetStudentFeedbacksResponseDto>>({
            success: false,
            message: '缺少 instanceId',
            data: null,
        }, { status: 400 });
    }

    const { data: instance, error: instErr } = await supabase
        .from('coach_plan_instances')
        .select('id, coach_id')
        .eq('id', instanceId)
        .maybeSingle();

    if (instErr || !instance) {
        return NextResponse.json<ApiData<GetStudentFeedbacksResponseDto>>({
            success: false,
            message: '计划实例不存在',
            data: null,
        }, { status: 404 });
    }

    const { data: coachRow } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

    if (!coachRow || instance.coach_id !== coachRow.id) {
        return NextResponse.json<ApiData<GetStudentFeedbacksResponseDto>>({
            success: false,
            message: '无权限查看该计划反馈',
            data: null,
        }, { status: 403 });
    }

    const { data: rows, error: fbErr } = await supabase
        .from('execution_feedbacks')
        .select('id, execution_id, day_index, content, difficulty_rating, coach_read_at, created_at')
        .eq('instance_id', instanceId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (fbErr) {
        return NextResponse.json<ApiData<GetStudentFeedbacksResponseDto>>({
            success: false,
            message: '查询失败',
            data: null,
        }, { status: 500 });
    }

    const feedbacks: FeedbackItem[] = (rows || []).map((r: any) => ({
        id: r.id,
        execution_id: r.execution_id ?? '',
        day_index: r.day_index ?? 0,
        content: r.content ?? null,
        difficulty_rating: r.difficulty_rating ?? null,
        coach_read_at: r.coach_read_at ?? null,
        created_at: r.created_at ?? '',
    }));

    const unread_count = feedbacks.filter((f) => !f.coach_read_at).length;

    if (markRead && unread_count > 0) {
        const unreadIds = feedbacks.filter((f) => !f.coach_read_at).map((f) => f.id);
        await supabase
            .from('execution_feedbacks')
            .update({ coach_read_at: new Date().toISOString() })
            .in('id', unreadIds);
    }

    return NextResponse.json<ApiData<GetStudentFeedbacksResponseDto>>({
        success: true,
        message: 'ok',
        data: { feedbacks, unread_count },
    });
}
