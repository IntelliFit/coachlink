import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type { GetLeaderboardDto, GetLeaderboardResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const { id } = await req.json() as GetLeaderboardDto;

    // 查询排行榜详情
    const { data, error } = await supabase
        .from('leaderboard_templates')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('获取排行榜失败:', error);
        return NextResponse.json({
            success: false,
            message: error.message || '获取排行榜失败',
            data: null
        }, { status: 500 });
    }

    // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<GetLeaderboardResponseDto>>({
        success: true,
        message: '获取排行榜成功',
        // GetLeaderboardResponseDto 反应的就是这个地方 data 的数据结构
        data: {
            leaderboard: data ? {
                id: data.id,
                title: data.title,
                description: data.description,
                start_at: data.start_at,
                end_at: data.end_at,
                rank_by_field: data.rank_by_field,
                sort_order: data.sort_order,
                type: data.type,
                rules: data.rules as any,
                form_schema: data.form_schema as any,
                remarks: data.remarks,
                created_at: data.created_at,
                creator_id: data.creator_id
            } : null
        }
    });
}