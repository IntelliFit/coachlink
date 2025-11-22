import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { AddActionDto, AddActionResponseDto } from './entity';

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
        coach_id,
        name,
        description,
        video_url,
        type
    } = await req.json() as AddActionDto;

    // 验证必要参数
    if (!coach_id || !name || !description || !type) {
        return NextResponse.json({
            success: false,
            message: '缺少必要参数',
            data: null
        }, { status: 400 });
    }

    // 验证教练身份
    const { data: coach, error: coachError } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('id', coach_id)
        .single();

    if (coachError || !coach) {
        return NextResponse.json<ApiData<AddActionResponseDto>>({
            success: false,
            message: '无权限访问此资源',
            data: null
        }, { status: 403 });
    }

    // 插入新动作
    const { data: action, error: insertError } = await supabase
        .from('exercise_actions')
        .insert({
            coach_id,
            name,
            description,
            video_url,
            type,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .select()
        .single();

    if (insertError) {
        console.error('添加动作失败:', insertError);
        return NextResponse.json<ApiData<AddActionResponseDto>>({
            success: false,
            message: '添加动作失败',
            data: null
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<AddActionResponseDto>>({
        success: true,
        message: '添加动作成功',
        data: {
            action
        }
    });
}