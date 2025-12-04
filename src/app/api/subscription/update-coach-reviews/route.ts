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

    // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<UpdateCoachReviewsResponseDto>>({
        success: true,
        message: '更新教练评价成功',
        // UpdateCoachReviewsResponseDto 反应的就是这个地方 data 的数据结构
        data: {
            review: data
        }
    });
}