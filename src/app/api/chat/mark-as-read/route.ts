import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
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

    /* ===============================
     * 2️⃣ 同步 chat_rooms.unread_members（用于列表 UI 的未读样式）
     * =============================== */
    const { data: roomRow, error: roomErr } = await supabase
        .from('chat_rooms')
        .select('unread_members')
        .eq('id', roomId)
        .single();

    if (roomErr) {
        console.error('获取会话未读成员失败:', roomErr);
        return NextResponse.json({
            success: false,
            message: '标记已读失败',
            data: null
        }, { status: 500 });
    }

    const unreadMembers = (roomRow?.unread_members || []).filter((id: string) => id !== userId);
    const { error: updateRoomErr } = await supabase
        .from('chat_rooms')
        .update({ unread_members: unreadMembers })
        .eq('id', roomId);

    if (updateRoomErr) {
        console.error('更新会话未读成员失败:', updateRoomErr);
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
