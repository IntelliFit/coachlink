import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type { DeleteCoachReviewsDto, DeleteCoachReviewsResponseDto } from './entity';

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
        reviewId
    } = await req.json() as DeleteCoachReviewsDto;

    // 检查权限
    const { data: review, error: reviewError } = await supabase
        .from('coach_reviews')
        .select('*')
        .eq('id', reviewId)
        .single();

    if (reviewError) {
        return NextResponse.json({
            success: false,
            message: '获取评价失败',
            data: null
        }, { status: 500 });
    }

    if (review.coach_id !== userId) {
        return NextResponse.json({
            success: false,
            message: '无权限删除评价',
            data: null
        }, { status: 403 });
    }

    // 删除教练评价
    const { error } = await supabase
        .from('coach_reviews')
        .delete()
        .eq('id', reviewId);

    if (error) {
        return NextResponse.json<ApiData<DeleteCoachReviewsResponseDto>>({
            success: false,
            message: '删除教练评价失败',
            data: null
        }, { status: 500 });
    }

    // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<DeleteCoachReviewsResponseDto>>({
        success: true,
        message: '删除教练评价成功',
        // DeleteCoachReviewsResponseDto 反应的就是这个地方 data 的数据结构
        data: null
    });
}