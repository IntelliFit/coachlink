import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type { GetCoachReviewsDto, GetCoachReviewsResponseDto } from './entity';

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
        subscriptionId
    } = await req.json() as GetCoachReviewsDto;

    // 获取教练评价
    const { data, error } = await supabase
        .from('coach_reviews')
        .select('*')
        .eq('coach_subscription_id', subscriptionId);

    if (error) {
        return NextResponse.json<ApiData<GetCoachReviewsResponseDto>>({
            success: false,
            message: '获取教练评价失败',
            data: null
        }, { status: 500 });
    }

    // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<GetCoachReviewsResponseDto>>({
        success: true,
        message: '获取教练评价成功',
        // GetCoachReviewsResponseDto 反应的就是这个地方 data 的数据结构
        data: {
            reviews: data || []
        }
    });
}