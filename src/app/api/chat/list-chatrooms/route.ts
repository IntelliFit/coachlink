import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { getAuthUser } from '@/lib/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { GetChatroomsDto, GetChatroomsResponseDto, ChatroomItem } from './entity';

async function resolveUserId(req: Request) {
    const session = await getServerSession();
    if (session?.user?.id) return session.user.id;
    const authResult = await getAuthUser(req);
    return authResult.isAuthenticated ? authResult.userId : null;
}

async function handleListChatrooms(req: Request, body: GetChatroomsDto = {}) {
    const userId = await resolveUserId(req);
    if (!userId) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const { page = 1, limit = 20 } = body;
    const offset = (page - 1) * limit;

    const { data: chatRooms, error, count } = await supabase
        .from('chat_rooms')
        .select('*', { count: 'exact' })
        .eq('is_archived', false)
        .contains('members', [userId])
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

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

    const roomIds = chatRooms.map(room => room.id);

    const { data: unreadRows, error: unreadError } = await supabase
        .from('chat_room_unreads')
        .select('room_id, unread_count')
        .eq('user_id', userId)
        .in('room_id', roomIds);

    if (unreadError) {
        console.error('查询未读数失败:', unreadError);
        return NextResponse.json({
            success: false,
            message: '获取未读数失败',
            data: null
        }, { status: 500 });
    }

    const unreadMap = new Map<string, number>();
    (unreadRows || []).forEach(row => unreadMap.set(row.room_id, row.unread_count));

    const idSet = new Set<string>();
    chatRooms.forEach(room => room.members.forEach(id => idSet.add(id)));
    idSet.delete(userId);

    const userMap = new Map<string, { user_id: string, nickname: string, avatar_url: string }>();
    if (idSet.size > 0) {
        const { data: profiles } = await supabase
            .from('user_profiles')
            .select('user_id, nickname, avatar_url')
            .in('user_id', [...idSet]);

        profiles?.forEach(p => userMap.set(p.user_id, p));
    }

    const returnChatRooms: ChatroomItem[] = chatRooms.map(room => {
        const chatUserId = room.members.find(id => id !== userId);
        const chatUserProfile = chatUserId ? userMap.get(chatUserId) : null;

        return {
            id: room.id,
            chatUserId,
            chatUserProfile: {
                name: chatUserProfile?.nickname || '',
                avatar: chatUserProfile?.avatar_url || null
            },
            lastMessage: room.last_message,
            lastMessageAt: room.last_message_at,
            unreadCount: unreadMap.get(room.id) ?? 0,
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

export async function POST(req: Request) {
    let body: GetChatroomsDto = {};
    try { body = await req.json(); } catch { /* body is empty or invalid, use defaults */ }
    return handleListChatrooms(req, body);
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    return handleListChatrooms(req, {
        page: Number(url.searchParams.get('page') || 1),
        limit: Number(url.searchParams.get('limit') || 20),
    });
}
