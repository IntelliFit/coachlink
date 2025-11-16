import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import { ApiData } from '@/types/api';
import { ReviewVideoResponseDto } from './entity';

export async function POST(request: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const { videoId, coachId, coachName, feedback } = await request.json();

    // 验证必要参数
    if (!videoId || !coachId || !coachName) {
        return NextResponse.json({
            success: false,
            message: '缺少必要参数',
            data: null
        }, { status: 400 });
    }

    const coachFeedback = {
        ...feedback,
        coach_name: coachName,
        coach_id: coachId,
        reviewed_at: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from('training_videos')
        .update({
            coach_feedback: coachFeedback,
            review_status: 'reviewed',
            reviewed_at: new Date().toISOString()
        })
        .eq('id', videoId)
        .select()
        .single();

    if (error) {
        throw new Error(`更新点评失败: ${error.message}`);
    }

    return NextResponse.json<ApiData<ReviewVideoResponseDto>>({
        success: true,
        message: '点评视频成功',
        data: '点评视频成功'
    });
}