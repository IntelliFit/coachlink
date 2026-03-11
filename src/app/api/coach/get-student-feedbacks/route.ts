import { NextResponse } from 'next/server';
import { serviceRoleSupabase as supabase } from '@/lib/supabaseClient';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import type { ApiData } from '@/types/api';
import type { GetStudentFeedbacksDto, GetStudentFeedbacksResponseDto, FeedbackItem } from './entity';

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

    // 验证计划实例归属：仅教练可查看该实例下学员反馈
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

    // 查询 execution_feedbacks（若表不存在或报错则返回空列表）
    let feedbacks: FeedbackItem[] = [];
    let unread_count = 0;

    const { data: rows, error: fbErr } = await supabase
        .from('execution_feedbacks')
        .select('day_index, content, difficulty_rating, created_at, instance_id')
        .eq('instance_id', instanceId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (!fbErr && rows && rows.length > 0) {
        feedbacks = rows.map((r: any) => ({
            day_index: r.day_index ?? 0,
            content: r.content ?? null,
            difficulty_rating: r.difficulty_rating ?? null,
            created_at: r.created_at,
            instance_id: r.instance_id,
        }));
    }
    // markRead 暂不落库，仅返回数据；若表有 read_at 等字段可在此更新

    return NextResponse.json<ApiData<GetStudentFeedbacksResponseDto>>({
        success: true,
        message: 'ok',
        data: { feedbacks, unread_count },
    });
}
