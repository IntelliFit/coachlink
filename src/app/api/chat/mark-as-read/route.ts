import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';

export interface MarkAsReadDto {
    roomId: string;
}

export interface MarkAsReadResponseDto {
    markedCount: number;
}

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
    const { roomId } = (await req.json()) as MarkAsReadDto;

    if (!roomId) {
        return NextResponse.json({
            success: false,
            message: '缺少会话ID',
            data: null
        }, { status: 400 });
    }

    /* ===============================
     * 1️⃣ 更新 chat_room_unreads
     * =============================== */
    const { data: unreadRow, error: unreadError } = await supabase
        .from('chat_room_unreads')
        .update({ unread_count: 0 })
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .select()
        .single();

    if (unreadError) {
        console.error('更新未读数失败:', unreadError);
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
            markedCount: unreadRow ? 1 : 0
        }
    });
}
