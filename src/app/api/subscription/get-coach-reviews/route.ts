import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getAuthUser } from '@/lib/auth';
import { resolveReadableReviewSubscriptionIds } from '@/lib/coachReviewAccess';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type { GetCoachReviewsDto, GetCoachReviewsResponseDto } from './entity';

export async function POST(req: Request) {
    // 使用统一鉴权函数,支持session和token两种方式
    const authResult = await getAuthUser(req);
    if (!authResult.isAuthenticated || !authResult.userId) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    // 重点！通过鉴权结果获取用户 ID
    const userId = authResult.userId;

    const {
        subscriptionId,
        studentId
    } = await req.json() as GetCoachReviewsDto;

    // 先按登录身份核对能看哪些订阅：学员只看自己的，教练只看自己名下的，不传筛选时绝不返回全表。
    let access;
    try {
        access = await resolveReadableReviewSubscriptionIds(supabase, userId, { subscriptionId, studentId });
    } catch (accessError) {
        console.error('核对教练记录权限失败:', accessError);
        return NextResponse.json({ success: false, message: '获取教练评价失败', data: null }, { status: 500 });
    }
    if (!access.ok) {
        return NextResponse.json<ApiData<GetCoachReviewsResponseDto>>({
            success: false,
            message: access.message,
            data: null
        }, { status: access.status });
    }
    if (access.subscriptionIds.length === 0) {
        return NextResponse.json<ApiData<GetCoachReviewsResponseDto>>({
            success: true,
            message: '获取教练评价成功',
            data: { reviews: [] }
        });
    }

    const query = supabase
        .from('coach_reviews')
        .select('*')
        .in('coach_subscription_id', access.subscriptionIds)
        .order('created_at', { ascending: false }); // 按创建时间倒序排列

    // 获取教练评价
    const { data, error } = await query;

    if (error) {
        console.error('获取教练评价失败:', error);
        return NextResponse.json<ApiData<GetCoachReviewsResponseDto>>({
            success: false,
            message: error.message || '获取教练评价失败',
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
