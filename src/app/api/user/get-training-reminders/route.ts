import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import { GetTrainingRemindersDto } from './entity';

export async function POST(request: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const userId = session.user.id;
    const {
        training_plan_id: trainingPlanId
    } = await request.json() as GetTrainingRemindersDto;

    if (!trainingPlanId) {
        return NextResponse.json({
            success: false,
            message: '缺少训练计划ID',
            data: null
        }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('training_reminders')
        .select('*')
        .eq('user_id', userId)
        .eq('training_plan_id', trainingPlanId)
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(error.message);
    }

    return NextResponse.json({
        success: true,
        message: '获取训练提醒成功',
        data: {
            reminders: data || []
        }
    });

}