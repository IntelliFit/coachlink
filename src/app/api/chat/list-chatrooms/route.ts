import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { GetChatroomsDto, GetChatroomsResponseDto, ConversationItem } from './entity';

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
    const { page = 1, limit = 20 } = await req.json() as GetChatroomsDto;
    const offset = (page - 1) * limit;

    const { data: chatRooms, error, count } = await supabase.from('chat_rooms')
        .select('*', { count: 'exact' })
        .eq('is_archived', false)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1)
        .contains('members', [userId]);

    if (error) {
        console.error('查询会话失败:', error);
        return NextResponse.json({
            success: false,
            message: '获取会话列表失败',
            data: null
        }, { status: 500 });
    }

    if (!chatRooms || chatRooms.length === 0) {
        return NextResponse.json<ApiData<GetChatroomsResponseDto>>({
            success: true,
            message: '暂无会话',
            data: {
                chatRooms: [],
                total: 0
            }
        });
    }

    // 获取对话者信息
    const idSet = new Set<string>();
    for (const chatRoom of chatRooms) {
        chatRoom.members.forEach(id => idSet.add(id));
    }

    idSet.delete(userId);

    const userMap = new Map<string, { user_id: string, nickname: string, avatar_url: string }>();
    const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, nickname, avatar_url')
        .in('user_id', [...idSet]);

    profiles?.forEach(p => userMap.set(p.user_id, p));

    // 组装数据
    const returnChatRooms: ConversationItem[] = chatRooms.map(room => {
        // 拿第一个非自己的用户名作为对话的缩略
        const chatUserId = room.members.find(id => id !== userId);
        const chatUserProfile = userMap.get(chatUserId);

        return {
            id: room.id,
            chatUserId,
            chatUserProfile: {
                name: chatUserProfile?.nickname || '',
                avatar: chatUserProfile?.avatar_url || null
            },
            lastMessage: room.last_message,
            lastMessageAt: room.last_message_at,
            unreadMembers: room.unread_members || [],
            isArchived: room.is_archived || false
        };
    });

    return NextResponse.json<ApiData<GetChatroomsResponseDto>>({
        success: true,
        message: '获取会话列表成功',
        data: {
            chatRooms: returnChatRooms,
            total: count || 0
        }
    });
}

