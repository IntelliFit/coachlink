import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type { UpdateCoachReviewsDto, UpdateCoachReviewsResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    // 重点！通过 session 获取用户 ID
    const userId = session.user.id;

    if (!session.user.is_coach) {
        return NextResponse.json({
            success: false,
            message: '用户不是教练',
            data: null
        }, { status: 403 });
    }

    const {
        reviewId,
        reviewText,
        mediaUrls
    } = await req.json() as UpdateCoachReviewsDto;

    // 更新教练评价
    const { data, error } = await supabase
        .from('coach_reviews')
        .update({
            review_text: reviewText,
            media_urls: mediaUrls,
            updated_at: new Date().toISOString()
        })
        .eq('id', reviewId)
        .select()
        .single();

    if (error) {
        return NextResponse.json<ApiData<UpdateCoachReviewsResponseDto>>({
            success: false,
            message: '更新教练评价失败',
            data: null
        }, { status: 500 });
    }

    // 检查权限，当前的 session 的 user 必须是 coach_id
    const { data: coach, error: coachError } = await supabase
        .from('coaches')
        .select('*')
        .eq('user_id', userId)
        .single();
    
    if (coachError) {
        return NextResponse.json<ApiData<UpdateCoachReviewsResponseDto>>({
            success: false,
            message: coachError.message,
            data: null
        }, { status: 500 });
    }

    if (data.coach_id !== coach.id) {
        return NextResponse.json<ApiData<UpdateCoachReviewsResponseDto>>({
            success: false,
            message: '用户不是该教练',
            data: null
        }, { status: 403 });
    }

    return NextResponse.json<ApiData<UpdateCoachReviewsResponseDto>>({
        success: true,
        message: '更新教练评价成功',
        // UpdateCoachReviewsResponseDto 反应的就是这个地方 data 的数据结构
        data: {
            review: data
        }
    });
}