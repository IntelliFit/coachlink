import { NextResponse } from 'next/server';
import { getApiUserId } from '@/lib/getApiUserId';
import type { ApiData } from '@/types/api';
import type { GetChatroomDto, ChatroomDetail, GetChatroomResponseDto } from './entity';
import supabase from '@/lib/supabaseClient';
import { normalizePrivateChatMembers } from '@/lib/chatMembers';

type ChatRoomRow = {
    id: string;
    members: string[] | null;
    last_message: string | null;
    last_message_at: string | null;
    unread_members: string[] | null;
    is_archived: boolean | null;
};

function toChatroomDetail(room: ChatRoomRow): ChatroomDetail {
    return {
        id: room.id,
        members: room.members || [],
        lastMessage: room.last_message,
        lastMessageAt: room.last_message_at,
        unreadMembers: room.unread_members || [],
        isArchived: room.is_archived || false,
    };
}

async function toChatroomDetailWithPeer(room: ChatRoomRow, currentUserId: string): Promise<ChatroomDetail> {
    const detail = toChatroomDetail(room);
    const peerUserId = detail.members.find(id => id !== currentUserId);
    if (!peerUserId) return detail;

    const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('nickname, avatar_url')
        .eq('user_id', peerUserId)
        .maybeSingle();

    if (error) {
        console.warn('[get-chatroom] load peer profile failed:', error);
        return detail;
    }

    return {
        ...detail,
        chatUserProfile: {
            name: profile?.nickname || '',
            avatar: profile?.avatar_url || null,
        },
    };
}

async function findActivePrivateRoom(members: [string, string]) {
    const { data, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('is_archived', false)
        .contains('members', members)
        .containedBy('members', members)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    return { data, error };
}

// 修改后的逻辑只接收 members 参数，查找包含所有成员的会话
export async function POST(req: Request) {
    const userId = await getApiUserId(req);
    if (!userId) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }
    const { members, roomId } = await req.json() as GetChatroomDto;

    if (roomId && typeof roomId === 'string') {
        const { data: byId, error: byIdErr } = await supabase
            .from('chat_rooms')
            .select('*')
            .eq('id', roomId)
            .maybeSingle();

        if (byIdErr || !byId) {
            return NextResponse.json({
                success: false,
                message: '会话不存在',
                data: { chatroom: null }
            }, { status: 404 });
        }

        const membersArr = (byId.members as string[]) || [];
        if (!membersArr.includes(userId)) {
            return NextResponse.json({
                success: false,
                message: '没有权限',
                data: null
            }, { status: 403 });
        }

        const normalized = await normalizePrivateChatMembers(supabase, membersArr, userId);
        if (normalized.ok === false) {
            return NextResponse.json({
                success: false,
                message: normalized.message,
                data: null,
            }, { status: normalized.status });
        }

        // Historical malformed rooms are archived during data repair. Returning
        // the canonical room lets updated clients recover old deep links.
        if (byId.is_archived || normalized.normalizedLegacyCoachIds) {
            const replacement = await findActivePrivateRoom(normalized.members);
            if (replacement.error) {
                console.error('[get-chatroom] find replacement room failed:', replacement.error);
                return NextResponse.json({
                    success: false,
                    message: '查找正确会话失败',
                    data: null,
                }, { status: 500 });
            }
            if (!replacement.data || replacement.data.id === byId.id) {
                return NextResponse.json({
                    success: false,
                    message: '该会话已失效，请返回消息列表重新进入',
                    data: null,
                }, { status: 409 });
            }

            return NextResponse.json<ApiData<GetChatroomResponseDto>>({
                success: true,
                message: '已切换到正确会话',
                data: { chatroom: await toChatroomDetailWithPeer(replacement.data as ChatRoomRow, userId) },
            });
        }

        return NextResponse.json<ApiData<GetChatroomResponseDto>>({
            success: true,
            message: '获取会话成功',
            data: {
                chatroom: await toChatroomDetailWithPeer(byId as ChatRoomRow, userId),
            }
        });
    }

    const normalized = await normalizePrivateChatMembers(supabase, members, userId);
    if (normalized.ok === false) {
        return NextResponse.json({
            success: false,
            message: normalized.message,
            data: null,
        }, { status: normalized.status });
    }

    const normalizedMembers = normalized.members;
    let { data: chatroom, error } = await findActivePrivateRoom(normalizedMembers);

    if (error) {
        return NextResponse.json({
            success: false,
            message: '会话不存在',
            data: { chatroom: null }
        }, { status: 404 });
    }

    if (!chatroom) {
        // 不存在则创建
        const { data: chatRoomData, error: chatRoomError } = await supabase
            .from('chat_rooms')
            .insert({
                members: normalizedMembers,
                type: 'private',
                unread_members: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select('id')
            .single();

        if (chatRoomError) {
            if (chatRoomError.code === '23505') {
                const concurrentRoom = await findActivePrivateRoom(normalizedMembers);
                if (concurrentRoom.data) {
                    return NextResponse.json<ApiData<GetChatroomResponseDto>>({
                        success: true,
                        message: '获取会话成功',
                        data: { chatroom: await toChatroomDetailWithPeer(concurrentRoom.data as ChatRoomRow, userId) },
                    });
                }
            }
            console.error(chatRoomError);

            return NextResponse.json({
                success: false,
                message: '创建聊天室失败',
                data: null
            });
        }

        return NextResponse.json<ApiData<GetChatroomResponseDto>>({
            success: true,
            message: '创建聊天室成功',
            data: {
                chatroom: {
                    id: chatRoomData.id,
                    members: normalizedMembers,
                    lastMessage: '',
                    lastMessageAt: new Date().toISOString(),
                    unreadMembers: [],
                    isArchived: false
                }
            }
        });
    }

    return NextResponse.json<ApiData<GetChatroomResponseDto>>({
        success: true,
        message: '获取会话成功',
        data: {
            chatroom: await toChatroomDetailWithPeer(chatroom as ChatRoomRow, userId),
        }
    });
}
