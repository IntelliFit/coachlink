import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type { UpdateSubscriptionDto, UpdateSubscriptionResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    // 通过 session 获取用户 ID
    const userId = session.user.id;

    const {
        id,
        ...updateData
    } = await req.json() as UpdateSubscriptionDto;

    // 参数验证 - 必须提供订阅ID
    if (!id) {
        return NextResponse.json<ApiData<UpdateSubscriptionResponseDto>>({
            success: false,
            message: '缺少订阅ID',
            data: null
        }, { status: 400 });
    }

    // 检查订阅是否存在且属于当前用户
    const { data: subscription, error: subscriptionError } = await supabase
        .from('coach_subscriptions')
        .select('*')
        .eq('id', id)
        .single();

    if (subscriptionError || !subscription) {
        return NextResponse.json<ApiData<UpdateSubscriptionResponseDto>>({
            success: false,
            message: '指定的订阅不存在',
            data: null
        }, { status: 404 });
    }

    // 验证用户权限（必须是学生或教练）
    if (subscription.student_id !== userId && subscription.coach_id !== userId) {
        return NextResponse.json<ApiData<UpdateSubscriptionResponseDto>>({
            success: false,
            message: '无权修改此订阅',
            data: null
        }, { status: 403 });
    }

    // 更新订阅记录
    const { data: updatedSubscription, error: updateError } = await supabase
        .from('coach_subscriptions')
        .update({
            ...updateData,
        })
        .eq('id', id)
        .select()
        .single();

    if (updateError || !updatedSubscription) {
        return NextResponse.json<ApiData<UpdateSubscriptionResponseDto>>({
            success: false,
            message: '更新订阅失败: ' + (updateError?.message || 'Unknown error'),
            data: null
        }, { status: 500 });
    }

    // 重要！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<UpdateSubscriptionResponseDto>>({
        success: true,
        message: '订阅更新成功',
        // UpdateSubscriptionResponseDto 反应的就是这个地方 data 的数据结构
        data: {
            subscription: updatedSubscription
        }
    });
}