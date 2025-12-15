import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import type { ApiData } from '@/types/api';
import type { GetChatroomDto, ChatroomDetail, GetChatroomResponseDto } from './entity';
import supabase from '@/lib/supabaseClient';

// 修改后的逻辑只接收 members 参数，查找包含所有成员的会话
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
        members
    } = await req.json() as GetChatroomDto;

    if (!Array.isArray(members) || members.length < 2) {
        return NextResponse.json({
            success: false,
            message: '参数非法',
            data: null
        }, { status: 400 });
    }

    if (!members.includes(userId)) {
        return NextResponse.json({
            success: false,
            message: '没有权限',
            data: null
        }, { status: 403 });
    }

    let { data: chatroom, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .contains('members', members)
        .maybeSingle();

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
                members: members,
                type: 'private',
                unread_members: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select('id')
            .single();

        if (chatRoomError) {
            console.error(chatRoomError);
            
            return NextResponse.json({
                success: false,
                message: '创建聊天室失败',
                data: null
            });
        }

        return NextResponse.json({
            success: true,
            message: '创建聊天室成功',
            data: {
                id: chatRoomData.id,
                members,
                lastMessage: '',
                lastMessageAt: new Date().toISOString(),
                unreadMembers: [],
                isArchived: false
            }
        });
    }

    return NextResponse.json<ApiData<GetChatroomResponseDto>>({
        success: true,
        message: '获取会话成功',
        data: {
            chatroom: {
                id: chatroom.id,
                members: chatroom.members,
                lastMessage: chatroom.last_message,
                lastMessageAt: chatroom.last_message_at,
                unreadMembers: chatroom.unread_members || [],
                isArchived: chatroom.is_archived || false,
            }
        }
    });
}
