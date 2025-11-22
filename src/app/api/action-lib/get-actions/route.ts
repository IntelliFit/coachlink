import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { GetActionsDto, GetActionsResponseDto, ExerciseAction } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const { coach_id, search, page = 1, limit = 12 } = await req.json() as GetActionsDto;

    // 验证教练身份
    const { data: coach, error: coachError } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('id', coach_id)
        .single();

    if (coachError || !coach) {
        return NextResponse.json<ApiData<GetActionsResponseDto>>({
            success: false,
            message: '无权限访问此资源',
            data: null
        }, { status: 403 });
    }

    // 构建查询
    let query = supabase
        .from('exercise_actions')
        .select('*', { count: 'exact' })
        .eq('coach_id', coach_id);

    // 添加搜索条件
    if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // 添加分页
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to).order('created_at', { ascending: false });

    // 执行查询
    const { data: actions, count, error } = await query;

    if (error) {
        console.error('获取动作列表失败:', error);
        return NextResponse.json<ApiData<GetActionsResponseDto>>({
            success: false,
            message: '获取动作列表失败',
            data: null
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<GetActionsResponseDto>>({
        success: true,
        message: '获取动作列表成功',
        data: {
            actions: actions as ExerciseAction[],
            total: count || 0,
            page,
            limit
        }
    });
}