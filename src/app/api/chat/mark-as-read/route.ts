import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { MarkAsReadDto, MarkAsReadResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const userId = session.user.id;
    const {
        roomId,
        messageIds
    } = await req.json() as MarkAsReadDto;

    if (!roomId) {
        return NextResponse.json({
            success: false,
            message: '缺少会话ID',
            data: null
        }, { status: 400 });
    }

    // 构建更新查询
    let query = supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('room_id', roomId)
        .eq('is_read', false);

    if (messageIds && messageIds.length > 0) {
        query = query.in('id', messageIds);
    }

    const { count, error } = await query;

    if (error) {
        console.error('标记已读失败:', error);
        return NextResponse.json({
            success: false,
            message: '标记已读失败',
            data: null
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<MarkAsReadResponseDto>>({
        success: true,
        message: '标记已读成功',
        data: {
            markedCount: count || 0
        }
    });
}

