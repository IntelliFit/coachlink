import { NextResponse } from 'next/server';
import { getApiUserId } from '@/lib/getApiUserId';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { GetUnreadCountResponseDto } from './entity';

async function handleUnreadCount(req: Request) {
    const userId = await getApiUserId(req);
    if (!userId) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    // 直接从未读计数表聚合
    const { data, error } = await supabase
        .from('chat_room_unreads')
        .select('unread_count')
        .eq('user_id', userId);

    if (error) {
        console.error(error);
        return NextResponse.json({
            success: false,
            message: '获取未读数失败',
            data: null
        }, { status: 500 });
    }

    const totalUnread =
        data?.reduce((sum, row) => sum + row.unread_count, 0) ?? 0;

    return NextResponse.json<ApiData<GetUnreadCountResponseDto>>({
        success: true,
        message: '获取未读数成功',
        data: {
            totalUnread
        }
    });
}

export async function POST(req: Request) {
    return handleUnreadCount(req);
}

export async function GET(req: Request) {
    return handleUnreadCount(req);
}
