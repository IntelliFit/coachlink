import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { GetWeekDaysDto, GetWeekDaysResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const { training_plan_id, week_number } = await req.json() as GetWeekDaysDto;

    if (!training_plan_id || !week_number) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '缺少必要参数',
            data: null
        }, { status: 400 });
    }

    try {
        const { data, error } = await supabase
            .from('training_plan_details')
            .select('day_of_week, session_focus, order_index')
            .eq('training_plan_id', training_plan_id)
            .eq('week_number', week_number)
            .order('order_index', { ascending: true });

        if (error) throw error;

        const response: GetWeekDaysResponseDto = {
            week_days: data || []
        };

        return NextResponse.json<ApiData<GetWeekDaysResponseDto>>({
            success: true,
            message: '获取训练日成功',
            data: response
        });
    } catch (error: any) {
        console.error('获取训练日失败:', error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: error.message || '获取训练日失败',
            data: null
        }, { status: 500 });
    }
}





