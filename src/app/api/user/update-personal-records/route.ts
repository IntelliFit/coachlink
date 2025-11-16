import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { UpdatePersonalRecordsDto, UpdatePersonalRecordsResponseDto } from './entity';
import { ApiData } from '@/types/api';

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
        exercises
    } = await req.json() as UpdatePersonalRecordsDto;

    // 验证训练数据
    if (!exercises || !Array.isArray(exercises)) {
        return NextResponse.json({
            success: false,
            message: '训练数据格式错误',
            data: null
        }, { status: 400 });
    }

    // 更新个人记录
    for (const exercise of exercises) {
        if (exercise.load_actual && exercise.sets_completed) {
            // 检查是否是新的个人记录
            const { data: existingRecord } = await supabase
                .from('personal_records')
                .select('*')
                .eq('user_id', userId)
                .eq('exercise_name', exercise.name)
                .order('max_weight', { ascending: false })
                .limit(1)
                .single();

            if (!existingRecord || (existingRecord.max_weight && exercise.load_actual > existingRecord.max_weight)) {
                await supabase.from('personal_records').insert({
                    user_id: userId,
                    exercise_name: exercise.name,
                    max_weight: exercise.load_actual,
                    date_achieved: new Date().toISOString().split('T')[0],
                    notes: `训练计划完成：${exercise.week_number}周${exercise.day_of_week}`
                });
            }
        }
    }

    return NextResponse.json<ApiData<UpdatePersonalRecordsResponseDto>>({
        success: true,
        message: '个人记录更新成功',
        data: '个人记录更新成功'
    });
}