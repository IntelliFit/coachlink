import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

import type { ApiData } from '@/types/api';
import type { ListEntriesDto, ListEntriesResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<ListEntriesResponseDto>>({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const body: ListEntriesDto = await req.json();

    // 设置默认分页参数
    const page = body.page || 1;
    const limit = body.limit || 10;
    const offset = (page - 1) * limit;

    // 构建查询
    let query = supabase
        .from('leaderboard_entries')
        .select('*', { count: 'exact' })
        .range(offset, offset + limit - 1)
        .order('score', { ascending: false }); // 按分数降序排列

    // 根据参数添加过滤条件
    if (body.template_id) {
        query = query.eq('template_id', body.template_id);
    }

    if (body.user_id) {
        query = query.eq('user_id', body.user_id);
    }

    query = query.eq('status', 'approved')

    const { data, error, count } = await query;

    if (error) {
        console.error('获取排行榜条目列表失败:', error);
        return NextResponse.json<ApiData<ListEntriesResponseDto>>({
            success: false,
            message: error.message,
            data: null
        });
    }

    return NextResponse.json<ApiData<ListEntriesResponseDto>>({
        success: true,
        message: '获取排行榜条目列表成功',
        data: {
            entries: data || [],
            total: count || 0,
            page,
            limit,
        },
    });
}