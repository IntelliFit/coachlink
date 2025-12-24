import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type { UpdateLeaderboardDto, UpdateLeaderboardResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    // 检查是否为管理员
    if (!session.user.is_admin) {
        return NextResponse.json({
            success: false,
            message: '权限不足，只有管理员可以更新排行榜',
            data: null
        }, { status: 403 });
    }

    const {
        id,
        title,
        description,
        start_at,
        end_at,
        rank_by_field,
        sort_order,
        type,
        rules,
        form_schema,
        remarks
    } = await req.json() as UpdateLeaderboardDto;

    // 更新排行榜模板
    const { error } = await supabase
        .from('leaderboard_templates')
        .update({
            ...(title !== undefined && { title }),
            ...(description !== undefined && { description: description || null }),
            ...(start_at !== undefined && { start_at: start_at || null }),
            ...(end_at !== undefined && { end_at: end_at || null }),
            ...(rank_by_field !== undefined && { rank_by_field }),
            ...(sort_order !== undefined && { sort_order: sort_order || null }),
            ...(type !== undefined && { type: type || null }),
            ...(rules !== undefined && { rules: rules || null }),
            ...(form_schema !== undefined && { form_schema: form_schema || null }),
            ...(remarks !== undefined && { remarks: remarks || null })
        })
        .eq('id', id);

    if (error) {
        console.error('更新排行榜失败:', error);
        return NextResponse.json({
            success: false,
            message: error.message || '更新排行榜失败',
            data: null
        }, { status: 500 });
    }

    // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<UpdateLeaderboardResponseDto>>({
        success: true,
        message: '排行榜更新成功',
        // UpdateLeaderboardResponseDto 反应的就是这个地方 data 的数据结构
        data: {
            success: true
        }
    });
}