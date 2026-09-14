import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { getAuthUser } from '@/lib/auth';
import supabase from '@/lib/supabaseClient';
import { maybeCreateCoachAiAutoReply } from '@/lib/coachAiAutoReply';
import { normalizePrivateChatMembers } from '@/lib/chatMembers';
import type { ApiData } from '@/types/api';
import type { SendMessageDto, SendMessageResponseDto } from './entity';

function buildReplyPreview(messageType: string, content: string | null, mediaUrl: string | null) {
    const trimmed = (content || '').trim();
    if (trimmed) {
        return trimmed.length > 120 ? `${trimmed.slice(0, 120)}...` : trimmed;
    }
    if (messageType === 'image') return '[图片]';
    if (messageType === 'video') return '[视频]';
    if (messageType === 'voice') return '[语音]';
    if (messageType === 'file') return '[文件]';
    if (messageType === 'video_reference') return '[视频引用]';
    if (mediaUrl) return '[媒体消息]';
    return '[消息]';
}

export async function POST(req: Request) {
    const session = await getServerSession();
    const authResult = session?.user?.id
        ? { isAuthenticated: true, userId: session.user.id }
        : await getAuthUser(req);
    if (!authResult.isAuthenticated || !authResult.userId) {
        return NextResponse.json(
            {
                success: false,
                message: '用户未登录',
                data: null,
            },
            { status: 401 },
        );
    }

    const userId = authResult.userId;
    const {
        roomId,
        messageType,
        content,
        mediaUrl,
        fileName,
        fileSize,
        duration,
        videoReferences,
        replyToMessageId,
    } = (await req.json()) as SendMessageDto;

    if (!roomId || !messageType) {
        return NextResponse.json(
            {
                success: false,
                message: '缺少必要参数',
                data: null,
            },
            { status: 400 },
        );
    }

    if (messageType !== 'video_reference' && messageType !== 'image' && !content) {
        return NextResponse.json(
            {
                success: false,
                message: '缺少消息内容',
                data: null,
            },
            { status: 400 },
        );
    }

    if (messageType === 'image' && !mediaUrl) {
        return NextResponse.json(
            {
                success: false,
                message: '缺少图片 URL',
                data: null,
            },
            { status: 400 },
        );
    }

    if (messageType === 'video_reference' && (!videoReferences || videoReferences.length === 0)) {
        return NextResponse.json(
            {
                success: false,
                message: '缺少视频引用',
                data: null,
            },
            { status: 400 },
        );
    }

    const { data: chatRoom, error: chatRoomError } = await supabase
        .from('chat_rooms')
        .select('id, members, is_archived')
        .eq('id', roomId)
        .single();

    if (chatRoomError || !chatRoom) {
        console.error('获取会话信息失败:', chatRoomError);
        return NextResponse.json(
            {
                success: false,
                message: '获取会话信息失败',
                data: null,
            },
            { status: 500 },
        );
    }

    if (!((chatRoom.members as string[]) || []).includes(userId)) {
        return NextResponse.json(
            {
                success: false,
                message: '无权限',
                data: null,
            },
            { status: 403 },
        );
    }

    if (chatRoom.is_archived) {
        return NextResponse.json(
            {
                success: false,
                message: '该会话已归档，请返回消息列表重新进入',
                data: null,
            },
            { status: 409 },
        );
    }

    const normalizedMembers = await normalizePrivateChatMembers(
        supabase,
        chatRoom.members,
        userId,
    );
    if (normalizedMembers.ok === false) {
        return NextResponse.json(
            {
                success: false,
                message: normalizedMembers.message,
                data: null,
            },
            { status: normalizedMembers.status },
        );
    }
    if (normalizedMembers.normalizedLegacyCoachIds) {
        return NextResponse.json(
            {
                success: false,
                message: '该会话成员信息已失效，请返回消息列表重新进入',
                data: null,
            },
            { status: 409 },
        );
    }

    const messageData: Record<string, any> = {
        room_id: roomId,
        sender_id: userId,
        message_type: messageType,
        content: content || '',
        media_url: mediaUrl || null,
        file_name: fileName || null,
        file_size: fileSize || null,
        duration: duration || null,
    };

    if (replyToMessageId) {
        const { data: repliedMessage, error: repliedMessageError } = await supabase
            .from('chat_messages')
            .select('id, room_id, sender_id, message_type, content, media_url')
            .eq('id', replyToMessageId)
            .single();

        if (repliedMessageError || !repliedMessage || repliedMessage.room_id !== roomId) {
            return NextResponse.json(
                {
                    success: false,
                    message: '被回复的消息不存在',
                    data: null,
                },
                { status: 400 },
            );
        }

        const { data: repliedProfile } = await supabase
            .from('user_profiles')
            .select('nickname')
            .eq('user_id', repliedMessage.sender_id)
            .maybeSingle();

        messageData.content_metadata = {
            ...(messageData.content_metadata || {}),
            reply_to_message: {
                id: repliedMessage.id,
                senderId: repliedMessage.sender_id,
                senderName: repliedProfile?.nickname || '用户',
                messageType: repliedMessage.message_type,
                contentPreview: buildReplyPreview(
                    repliedMessage.message_type,
                    repliedMessage.content,
                    repliedMessage.media_url,
                ),
                mediaUrl: repliedMessage.media_url || null,
            },
        };
    }

    if (messageType === 'video_reference' && videoReferences) {
        messageData.content_metadata = {
            ...(messageData.content_metadata || {}),
            video_references: videoReferences,
        };
        const count = videoReferences.length;
        messageData.content = count === 1 ? `[视频] ${videoReferences[0].actionName}` : `[${count}个视频]`;
    }

    const { data: message, error } = await supabase
        .from('chat_messages')
        .insert(messageData as any)
        .select('id, created_at')
        .single();

    if (error || !message) {
        console.error('发送消息失败:', error);
        return NextResponse.json(
            {
                success: false,
                message: '发送消息失败',
                data: null,
            },
            { status: 500 },
        );
    }

    let lastMessage = content;
    if (messageType === 'video_reference') {
        lastMessage = messageData.content;
    } else if (fileName) {
        lastMessage = '[文件]';
    } else if (mediaUrl) {
        lastMessage = '[图片]';
    }

    const { error: updateChatroomError } = await supabase
        .from('chat_rooms')
        .update({
            last_message: lastMessage,
            last_message_at: message.created_at,
            unread_members: chatRoom.members.filter((member: string) => member !== userId),
            updated_at: message.created_at,
        })
        .eq('id', roomId);

    if (updateChatroomError) {
        console.error(updateChatroomError);
        return NextResponse.json<ApiData<SendMessageResponseDto>>(
            {
                success: false,
                message: '更新会话状态失败',
                data: null,
            },
            { status: 500 },
        );
    }

    await maybeCreateCoachAiAutoReply({
        room: {
            id: roomId,
            members: chatRoom.members,
        },
        senderUserId: userId,
        messageType,
        content: messageData.content || '',
    });

    return NextResponse.json<ApiData<SendMessageResponseDto>>({
        success: true,
        message: '消息发送成功',
        data: {
            messageId: message.id,
            createdAt: message.created_at,
        },
    });
}
