import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

export async function POST(request: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const { coachId, pagination, reviewStatus } = await request.json();

    // 验证教练ID
    if (!coachId) {
        return NextResponse.json({
            success: false,
            message: '缺少教练ID',
            data: null
        }, { status: 400 });
    }

    // 放宽：直接从 training_videos 读取待点评视频（不依赖视图中不存在的 coach_id 字段）
    let query = supabase
        .from('training_videos')
        .select('*', { count: 'exact' })
        .is('deleted_at', null)
        .eq('requires_review', true);

    // 根据筛选状态添加条件
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
        throw new Error(`获取待点评视频失败: ${error.message}`);
    }

    return NextResponse.json({
        success: true,
        message: '获取待点评视频成功',
        data: {
            videos: data || [],
            total: count || 0
        }
    });

}