import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

import supabase from '@/lib/supabaseClient';
import { ReviewStatus } from '@/types/coach';

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ success: false, message: '未登录用户' }, { status: 401 });
    }

    const coachId = session.user.id;

    const body = await req.json();
    const { pagination, reviewStatus } = body as {
        pagination?: { page: number; limit: number };
        reviewStatus?: ReviewStatus;
    };

    // 读取待点评视频（当前版本放宽条件，不使用 coachId 过滤）
    let query = supabase
        .from('training_videos')
        .select('*', { count: 'exact' })
        .is('deleted_at', null)
        .eq('requires_review', true);

    if (reviewStatus) {
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
            message: '获取教练待点评视频失败'
        });
    }

    return NextResponse.json({
        videos: data || [],
        total: count || 0
    });
}
