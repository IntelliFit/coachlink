import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { SendMessageDto, SendMessageResponseDto } from './entity';

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
        messageType,
        content,
        mediaUrl,
        fileName,
        fileSize,
        duration
    } = await req.json() as SendMessageDto;

    // 验证参数
    if (!roomId || !messageType || !content) {
        return NextResponse.json({
            success: false,
            message: '缺少必要参数',
            data: null
        }, { status: 400 });
    }
    // 获取会话信息
    const { data: chatRoom, error: chatRoomError } = await supabase
        .from('chat_rooms')
        .select('members')
        .eq('id', roomId)
        .single();

    if (chatRoomError) {
        console.error('获取会话信息失败:', chatRoomError);
        return NextResponse.json({
            success: false,
            message: '获取会话信息失败',
            data: null
        }, { status: 500 });
    }

    // 插入消息
    const { data: message, error } = await supabase
        .from('chat_messages')
        .insert({
            room_id: roomId,
            sender_id: userId,
            message_type: messageType,
            content,
            media_url: mediaUrl || null,
            file_name: fileName || null,
            file_size: fileSize || null,
            duration: duration || null
        })
        .select('id, created_at')
        .single();

    if (error || !message) {
        console.error('发送消息失败:', error);
        return NextResponse.json({
            success: false,
            message: '发送消息失败',
            data: null
        }, { status: 500 });
    }

    // 更新会话状态，将除了发送者之外的人全部加入未读列表
    const { error: updateChatroomError } = await supabase
        .from('chat_rooms')
        .update({
            last_message: fileName ? '[文件]' : mediaUrl ? '图片' : content,
            last_message_at: message.created_at,
            unread_members: chatRoom.members.filter(member => member !== userId)
        })
        .eq('id', roomId);

    if (updateChatroomError) {
        console.error(updateChatroomError);
        
        return NextResponse.json<ApiData<SendMessageResponseDto>>({
            success: false,
            message: '更新会话状态失败',
            data: null
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<SendMessageResponseDto>>({
        success: true,
        message: '消息发送成功',
        data: {
            messageId: message.id,
            createdAt: message.created_at
        }
    });
}

