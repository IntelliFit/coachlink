import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { GetSubscriptionDto, GetSubscriptionResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const userId = session.user.id;

    const { id } = await req.json() as GetSubscriptionDto;

    if (!id) {
        return NextResponse.json<ApiData<GetSubscriptionResponseDto>>({
            success: false,
            message: '订阅ID不能为空',
            data: null
        }, { status: 400 });
    }

    // 查询指定ID的订阅信息
    const { data, error } = await supabase
        .from('coach_subscriptions')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        return NextResponse.json<ApiData<GetSubscriptionResponseDto>>({
            success: false,
            message: '获取订阅信息失败',
            data: null
        }, { status: 500 });
    }

    let coachId = userId;
    if (session.user.is_coach) {
        const { data: coach, error: coachError } = await supabase
            .from('coaches')
            .select('id')
            .eq('user_id', userId)
            .single();
        coachId = coach?.id;
    }

    // 检查用户是否有权限访问此订阅
    if (data.student_id !== userId && data.coach_id !== userId && data.coach_id !== coachId) {
        return NextResponse.json<ApiData<GetSubscriptionResponseDto>>({
            success: false,
            message: '无权限访问此订阅',
            data: null
        }, { status: 403 });
    }

    return NextResponse.json<ApiData<GetSubscriptionResponseDto>>({
        success: true,
        message: '获取订阅信息成功',
        data: {
            subscription: data
        }
    });
}