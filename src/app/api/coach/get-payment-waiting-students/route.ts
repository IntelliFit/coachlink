import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { GetPaymentWaitingStudentsDto, GetPaymentWaitingStudentsResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    let {
    } = await req.json() as GetPaymentWaitingStudentsDto;

    const { data: coach, error: coachError } = await supabase
        .from('coaches')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

    if (coachError) {
        return NextResponse.json({
            success: false,
            message: coachError.message
        });
    }

    const { data: subscriptions, error: subscriptionError } = await supabase
        .from('coach_subscriptions')
        .select('*')
        .eq('coach_id', coach.id)
        .order('created_at', { ascending: false });

    if (subscriptionError) {
        return NextResponse.json({
            success: false,
            message: subscriptionError.message
        });
    }

    return NextResponse.json<ApiData<GetPaymentWaitingStudentsResponseDto>>({
        success: true,
        message: '获取定价信息成功',
        data: {
            subscriptions
        }
    });
}