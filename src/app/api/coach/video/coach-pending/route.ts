import { NextResponse } from 'next/server';

import supabase from '@/lib/supabaseClient';
import { ReviewStatus } from '@/types/coach';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { GetPendingReviewVideosDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user) {
        return NextResponse.json({ success: false, message: '未登录用户' }, { status: 401 });
    }

    // 方案A：教练的会话ID是 users.id，需要先映射到 coaches.id
    const coachUserId = session.user.id;
    const { data: coachRow, error: coachErr } = await supabase
        .from('coaches')
        .select('id, status')
        .eq('user_id', coachUserId)
        .eq('status', 'approved')
        .maybeSingle();

    if (coachErr || !coachRow) {
        return NextResponse.json({ success: false, message: '未找到教练信息或未审核通过', data: null }, { status: 403 });
    }

    const coachId = coachRow.id;

    const body = await req.json();
    const { pagination, reviewStatus } = body as GetPendingReviewVideosDto;

    // 读取待点评视频（coaches.id 版本）
    // 1. 匹配 coach_id = 当前教练的 coaches.id
    // 2. 或者 user_id 在订阅该教练的学员列表中（兼容历史数据）
    // 注意：当前库中 training_videos.user_id → users/user_profiles 没有外键，无法用 PostgREST 隐式 JOIN
    // 先纯取视频，再二次查询 user_profiles 补充昵称
    let query = supabase
        .from('training_videos')
        .select(`*`, { count: 'exact' })
        .is('deleted_at', null)
        .eq('requires_review', true);

    // 先获取所有订阅该教练的学员 ID（coach_subscriptions.coach_id → coaches.id）
    const { data: subscriptions } = await supabase
        .from('coach_subscriptions')
        .select('student_id')
        .eq('coach_id', coachId)
        .eq('status', 'active');
    
    const studentIds = subscriptions?.map(s => s.student_id) || [];

    // 过滤条件：coach_id 等于当前教练 或 user_id 在订阅列表中
    if (studentIds.length > 0) {
        query = query.or(`coach_id.eq.${coachId},user_id.in.(${studentIds.join(',')})`);
    } else {
        query = query.eq('coach_id', coachId);
    }

    // 仅当 reviewStatus 为合法取值时才加过滤；'all' 或空值视为不过滤
    const allowedStatuses = ['pending', 'reviewed', 'not_required'] as const;
    if (typeof reviewStatus === 'string' && allowedStatuses.includes(reviewStatus)) {
        query = query.eq('review_status', reviewStatus);
    }

    if (pagination) {
        const from = (pagination.page - 1) * pagination.limit;
        const to = from + pagination.limit - 1;
        query = query.range(from, to);
    }

    const { data, count, error } = await query.order('created_at', { ascending: true });

    if (error) {
        console.error('获取教练待点评视频失败:', error);
        return NextResponse.json({
            success: false,
            message: '获取教练待点评视频失败',
            data: null
        }, { status: 500 });
    }

    // 二次查询补充用户昵称（若有）
    let videos = data || [];
    if (videos.length > 0) {
        const userIds = Array.from(new Set(videos.map(v => v.user_id).filter(Boolean))) as string[];
        if (userIds.length > 0) {
            const { data: profiles } = await supabase
                .from('user_profiles')
                .select('user_id, full_name, nickname')
                .in('user_id', userIds);
            const map: Record<string, { full_name: string | null; nickname: string | null }> = {};
            (profiles || []).forEach(p => { map[p.user_id] = { full_name: p.full_name, nickname: p.nickname }; });
            videos = videos.map(v => ({
                ...v,
                profile: v.user_id ? map[v.user_id] || null : null
            }));
        }
    }

    return NextResponse.json({
        success: true,
        message: '获取成功',
        data: {
            videos,
            total: count || 0
        }
    });
}
