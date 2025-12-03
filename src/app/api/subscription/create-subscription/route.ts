import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type { CreateSubscriptionDto, CreateSubscriptionResponseDto } from './entity';

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
        coachId,
        tier,
        orderId,
        monthlyPrice
    } = await req.json() as CreateSubscriptionDto;

    // 参数验证
    if (!coachId || !tier || monthlyPrice === undefined) {
        return NextResponse.json<ApiData<CreateSubscriptionResponseDto>>({
            success: false,
            message: '缺少必要参数',
            data: null
        }, { status: 400 });
    }

    // 检查教练是否存在且已获批准
    const { data: coach, error: coachError } = await supabase
        .from('coaches')
        .select('id')
        .eq('id', coachId)
        .eq('status', 'approved')
        .single();

    if (coachError || !coach) {
        return NextResponse.json<ApiData<CreateSubscriptionResponseDto>>({
            success: false,
            message: '指定的教练不存在或未获批准',
            data: null
        }, { status: 400 });
    }

    // 创建订阅记录
    const { data: subscription, error: subscriptionError } = await supabase
        .from('coach_subscriptions')
        .insert({
            student_id: userId,
            coach_id: coachId,
            tier: tier,
            monthly_price: monthlyPrice,
            status: 'active'
        })
        .select()
        .single();

    if (subscriptionError || !subscription) {
        return NextResponse.json<ApiData<CreateSubscriptionResponseDto>>({
            success: false,
            message: '创建订阅失败',
            data: null
        }, { status: 500 });
    }

    // 重要！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<CreateSubscriptionResponseDto>>({
        success: true,
        message: '订阅成功',
        // CreateSubscriptionResponseDto 反应的就是这个地方 data 的数据结构
        data: {
            subscription
        }
    });
}