import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { DeleteActionDto, DeleteActionResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const { id } = await req.json() as DeleteActionDto;

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
        return NextResponse.json<ApiData<DeleteActionResponseDto>>({
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
        return NextResponse.json<ApiData<DeleteActionResponseDto>>({
            success: false,
            message: '无权限访问此资源',
            data: null
        }, { status: 403 });
    }

    // 删除动作
    const { error: deleteError } = await supabase
        .from('exercise_actions')
        .delete()
        .eq('id', id);

    if (deleteError) {
        console.error('删除动作失败:', deleteError);
        return NextResponse.json<ApiData<DeleteActionResponseDto>>({
            success: false,
            message: '删除动作失败',
            data: null
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<DeleteActionResponseDto>>({
        success: true,
        message: '删除动作成功',
        data: null
    });
}