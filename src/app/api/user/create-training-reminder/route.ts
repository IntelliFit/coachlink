import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import { CreateTrainingReminderDto } from './entity';

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
    const {
        training_plan_id: trainingPlanId,
        reminder_type: reminderType,
        reminder_time: reminderTime,
        days_of_week: daysOfWeek,
        is_active: isActive
    } = await req.json() as CreateTrainingReminderDto;

    // 验证必填字段
    if (!trainingPlanId || !reminderType || !reminderTime) {
        return NextResponse.json({
            success: false,
            message: '缺少必要参数',
            data: null
        }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('training_reminders')
        .insert({
            user_id: userId,
            training_plan_id: trainingPlanId,
            reminder_type: reminderType,
            reminder_time: reminderTime,
            days_of_week: reminderType === 'weekly' ? daysOfWeek : null,
            is_active: isActive
        })
        .select()
        .single();

    if (error) {
        throw new Error(error.message);
    }

    return NextResponse.json({
        success: true,
        message: '创建训练提醒成功',
        data: {
            reminder: data
        }
    });

}