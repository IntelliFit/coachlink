import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type { UpdateTrainingExerciseDto, UpdateTrainingExerciseResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const {
        training_session_id,
        exercise_name,
        sets_completed,
        reps_completed,
        load_actual,
        notes
    } = await req.json() as UpdateTrainingExerciseDto;

    // 更新训练动作
    const { data, error } = await supabase
        .from('training_exercises')
        .update({
            sets_completed,
            reps_completed,
            load_actual,
            notes,
            updated_at: new Date().toISOString()
        })
        .eq('training_session_id', training_session_id)
        .eq('exercise_name', exercise_name)
        .eq('training_session_id', training_session_id) // 确保用户只能更新自己的训练动作
        .select()
        .single();

    if (error) {
        return NextResponse.json({
            success: false,
            message: error.message,
            data: null,
        });
    }

    // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<UpdateTrainingExerciseResponseDto>>({
        success: true,
        message: '训练动作更新成功',
        // UpdateTrainingExerciseResponseDto 反应的就是这个地方 data 的数据结构
        data: data
    });
}