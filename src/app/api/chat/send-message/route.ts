import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
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
    const { data: conversation, error: conversationError } = await supabase
        .from('chat_rooms')
        .select('members')
        .eq('id', roomId)
        .single();

    if (conversationError) {
        console.error('获取会话信息失败:', conversationError);
        return NextResponse.json({
            success: false,
            message: '获取会话信息失败',
            data: null
        }, { status: 500 });
    }

    // 确定接收者
    const { data: coachData } = await supabase
        .from('coaches')
        .select('id, user_id')
        .eq('user_id', userId)
        .single();

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

    return NextResponse.json<ApiData<SendMessageResponseDto>>({
        success: true,
        message: '消息发送成功',
        data: {
            messageId: message.id,
            createdAt: message.created_at
        }
    });
}

