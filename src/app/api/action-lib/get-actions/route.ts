import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { ApiData } from '@/types/api';
import type { GetActionsDto, GetActionsResponseDto, ExerciseAction } from './entity';

export async function POST(req: NextRequest) {
    const supabase = createRouteHandlerClient({ cookies });
    
    try {
        const { coach_id, search, page = 1, limit = 12 } = await req.json() as GetActionsDto;
        
        // Check if user is logged in
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            return NextResponse.json({
                success: false,
                message: '用户未登录',
                data: null
            }, { status: 401 });
        }

        // 验证教练身份
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        if (!profile || profile.role !== 'coach') {
            return NextResponse.json({
                success: false,
                message: '无权限访问此资源',
                data: null
            }, { status: 403 });
        }

    // 构建查询
    let query = supabase
        .from('coach_actions')
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

    const response: GetActionsResponseDto = {
        actions: actions as ExerciseAction[],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
    };

    return NextResponse.json<ApiData<GetActionsResponseDto>>({
        success: true,
        message: '获取动作列表成功',
        data: response
    });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '服务器内部错误',
            data: null
        }, { status: 500 });
    }
}