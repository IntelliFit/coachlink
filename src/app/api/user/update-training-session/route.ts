import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type { UpdateTrainingSessionDto, UpdateTrainingSessionResponseDto } from './entity';

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
        id,
        update
    } = await req.json() as UpdateTrainingSessionDto;

    // 更新训练会话状态为已完成
    const { data, error } = await supabase
        .from('training_sessions')
        .update(update)
        .eq('id', id)
        .eq('user_id', session.user.id) // 确保用户只能更新自己的会话
        .select()
        .single();

    if (error) {
        return Response.json(
            { error: 'Failed to complete training session' },
            { status: 500 }
        );
    }

    // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<UpdateTrainingSessionResponseDto>>({
        success: true,
        message: '训练会话已完成',
        // UpdateTrainingSessionResponseDto 反应的就是这个地方 data 的数据结构
        data: data
    });
}