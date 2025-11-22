import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { GetActionDto, GetActionResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const { id } = await req.json() as GetActionDto;

    // 验证必要参数
    if (!id) {
        return NextResponse.json({
            success: false,
            message: '缺少动作ID',
            data: null
        }, { status: 400 });
    }

    // 获取动作详情
    const { data: action, error } = await supabase
        .from('exercise_actions')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('获取动作详情失败:', error);
        return NextResponse.json<ApiData<GetActionResponseDto>>({
            success: false,
            message: '获取动作详情失败',
            data: null
        }, { status: 500 });
    }

    // 验证教练身份
    const { data: coach, error: coachError } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('id', action.coach_id)
        .single();

    if (coachError || !coach) {
        return NextResponse.json<ApiData<GetActionResponseDto>>({
            success: false,
            message: '无权限访问此资源',
            data: null
        }, { status: 403 });
    }

    return NextResponse.json<ApiData<GetActionResponseDto>>({
        success: true,
        message: '获取动作详情成功',
        data: {
            action
        }
    });
}