import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type { DeleteLeaderboardDto, DeleteLeaderboardResponseDto } from './entity';

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
            message: '权限不足，只有管理员可以删除排行榜',
            data: null
        }, { status: 403 });
    }

    const { id } = await req.json() as DeleteLeaderboardDto;

    // 删除排行榜模板
    const { error } = await supabase
        .from('leaderboard_templates')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('删除排行榜失败:', error);
        return NextResponse.json({
            success: false,
            message: error.message || '删除排行榜失败',
            data: null
        }, { status: 500 });
    }

    // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<DeleteLeaderboardResponseDto>>({
        success: true,
        message: '排行榜删除成功',
        // DeleteLeaderboardResponseDto 反应的就是这个地方 data 的数据结构
        data: {
            success: true
        }
    });
}