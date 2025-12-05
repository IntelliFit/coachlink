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
        subscriptionId,
        studentId
    } = await req.json() as GetCoachReviewsDto;

    // 构建查询
    let query = supabase
        .from('coach_reviews')
        .select('*')
        .order('created_at', { ascending: false }); // 按创建时间倒序排列

    // 如果提供了 subscriptionId，则添加此条件
    if (subscriptionId) {
        query = query.eq('coach_subscription_id', subscriptionId);
    }

    // 如果提供了 studentId，则联合查询
    if (studentId) {
        // 先找到该学生的所有订阅
        const { data: subscriptions, error: subscriptionError } = await supabase
            .from('coach_subscriptions')
            .select('id')
            .eq('student_id', studentId);

        if (subscriptionError) {
            return NextResponse.json<ApiData<GetCoachReviewsResponseDto>>({
                success: false,
                message: '获取订阅信息失败',
                data: null
            }, { status: 500 });
        }

        // 获取订阅ID列表
        const subscriptionIds = subscriptions?.map(sub => sub.id) || [];

        // 添加订阅ID过滤条件
        if (subscriptionIds.length > 0) {
            query = query.in('coach_subscription_id', subscriptionIds);
        } else {
            // 如果没有找到订阅，则返回空结果
            query = query.eq('coach_subscription_id', '0'); // 使用一个不可能的ID来返回空结果
        }
    }

    // 获取教练评价
    const { data, error } = await query;

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