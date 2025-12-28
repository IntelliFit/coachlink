import { NextResponse } from 'next/server';

import supabase from '@/lib/supabaseClient';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import type { ApiData } from '@/types/api';
import type { ReviewExecutionVideoDto, ReviewExecutionVideoResponseDto } from './entity';

/**
 * POST /api/coach/video/execution-review
 * 教练点评execution_set_videos视频
 */
export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user) {
        return NextResponse.json({ 
            success: false, 
            message: '未登录用户' 
        }, { status: 401 });
    }

    const coachUserId = session.user.id;

    // 获取教练信息
    const { data: coachRow, error: coachErr } = await supabase
        .from('coaches')
        .select('id, status')
        .eq('user_id', coachUserId)
        .eq('status', 'approved')
        .maybeSingle();

    if (coachErr || !coachRow) {
        return NextResponse.json({ 
            success: false, 
            message: '未找到教练信息或未审核通过', 
            data: null 
        }, { status: 403 });
    }

    const body = await req.json();
    const { videoId, feedback } = body as ReviewExecutionVideoDto;

    if (!videoId) {
        return NextResponse.json({
            success: false,
            message: '视频ID不能为空',
            data: null
        }, { status: 400 });
    }

    // 准备更新数据
    const updateData: any = {
        review_status: 'reviewed',
        reviewed_at: new Date().toISOString(),
        reviewed_by: coachUserId
    };

    if (feedback.rating !== undefined) {
        updateData.coach_rating = feedback.rating;
    }

    if (feedback.comment) {
        updateData.coach_feedback = feedback.comment;
    }

    // 更新视频审阅状态
    const { data: updatedVideo, error: updateError } = await supabase
        .from('execution_set_videos')
        .update(updateData)
        .eq('id', videoId)
        .select()
        .single();

    if (updateError || !updatedVideo) {
        console.error('更新视频审阅状态失败:', updateError);
        return NextResponse.json({
            success: false,
            message: '更新视频审阅状态失败',
            data: null
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<ReviewExecutionVideoResponseDto>>({
        success: true,
        message: '视频点评成功',
        data: updatedVideo
    });
}

