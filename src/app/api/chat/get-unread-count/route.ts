import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { GetUnreadCountResponseDto } from './entity';

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

    // 判断是教练还是学员
    const { data: coachData } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', userId)
        .single();


    // 查询未读数
    const { data: chatRooms, error: chatRoomsError } = await supabase
        .from('chat_rooms')
        .select('id, last_message, last_message_at, unread_members, members')
        .contains('members', [userId])
        .eq('is_archived', false);

    if (chatRoomsError) {
        console.error(chatRoomsError);

        return NextResponse.json({
            success: false,
            message: '获取未读数失败',
            data: null
        }, { status: 500 });
    }

    // 计算所有 unread_members 不包含自己的
    const totalUnread = chatRooms.reduce((acc, cur) => {
        return acc + cur.unread_members.filter(member => member !== userId).length;
    }, 0);

    return NextResponse.json<ApiData<GetUnreadCountResponseDto>>({
        success: true,
        message: '获取未读数成功',
        data: {
            totalUnread: totalUnread,
        }
    });
}

