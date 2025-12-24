import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type { ListLeaderboardDto, ListLeaderboardResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const { page = 1, limit = 10 } = await req.json() as ListLeaderboardDto;

    // 计算偏移量
    const offset = (page - 1) * limit;

    // 查询排行榜列表和总数
    const { data, error, count } = await supabase
        .from('leaderboard_templates')
        .select('*', { count: 'exact' })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error('获取排行榜列表失败:', error);
        return NextResponse.json({
            success: false,
            message: error.message || '获取排行榜列表失败',
            data: null
        }, { status: 500 });
    }

    // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<ListLeaderboardResponseDto>>({
        success: true,
        message: '获取排行榜列表成功',
        // ListLeaderboardResponseDto 反应的就是这个地方 data 的数据结构
        data: {
            leaderboards: data.map(item => ({
                id: item.id,
                title: item.title,
                description: item.description,
                start_at: item.start_at,
                end_at: item.end_at,
                rank_by_field: item.rank_by_field,
                sort_order: item.sort_order,
                type: item.type,
                remarks: item.remarks,
                created_at: item.created_at,
                creator_id: item.creator_id
            })),
            total: count || 0,
            page,
            limit
        }
    });
}