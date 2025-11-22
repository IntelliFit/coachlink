import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { UpdateActionDto, UpdateActionResponseDto } from './entity';

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
        name,
        description,
        video_url,
        type
    } = await req.json() as UpdateActionDto;

    // 验证必要参数
    if (!id) {
        return NextResponse.json({
            success: false,
            message: '缺少动作ID',
            data: null
        }, { status: 400 });
    }

    // 验证动作是否存在且属于当前教练
    const { data: existingAction, error: actionError } = await supabase
        .from('exercise_actions')
        .select('coach_id')
        .eq('id', id)
        .single();

    if (actionError || !existingAction) {
        return NextResponse.json<ApiData<UpdateActionResponseDto>>({
            success: false,
            message: '动作不存在',
            data: null
        }, { status: 404 });
    }

    // 验证教练身份
    const { data: coach, error: coachError } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('id', existingAction.coach_id)
        .single();

    if (coachError || !coach) {
        return NextResponse.json<ApiData<UpdateActionResponseDto>>({
            success: false,
            message: '无权限访问此资源',
            data: null
        }, { status: 403 });
    }

    // 构建更新数据
    const updateData: any = {
        updated_at: new Date().toISOString()
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (video_url !== undefined) updateData.video_url = video_url;
    if (type !== undefined) updateData.type = type;

    // 更新动作
    const { data: action, error: updateError } = await supabase
        .from('exercise_actions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (updateError) {
        console.error('更新动作失败:', updateError);
        return NextResponse.json<ApiData<UpdateActionResponseDto>>({
            success: false,
            message: '更新动作失败',
            data: null
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<UpdateActionResponseDto>>({
        success: true,
        message: '更新动作成功',
        data: {
            action
        }
    });
}