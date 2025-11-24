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
        conversation_id,
        message_type,
        content,
        media_url,
        file_name,
        file_size,
        duration
    } = await req.json() as SendMessageDto;

    // 验证参数
    if (!conversation_id || !message_type || !content) {
        return NextResponse.json({
            success: false,
            message: '缺少必要参数',
            data: null
        }, { status: 400 });
    }

    try {
        // 获取会话信息
        const { data: conversation } = await supabase
            .from('conversations' as any)
            .select('student_id, coach_id')
            .eq('id', conversation_id)
            .single() as any;

        if (!conversation) {
            return NextResponse.json({
                success: false,
                message: '会话不存在',
                data: null
            }, { status: 404 });
        }

        // 确定接收者
        const { data: coachData } = await supabase
            .from('coaches')
            .select('id, user_id')
            .eq('user_id', userId)
            .single();

        let receiverId: string;
        
        if (coachData && conversation.coach_id === coachData.id) {
            // 教练发送给学员
            receiverId = conversation.student_id;
        } else if (conversation.student_id === userId) {
            // 学员发送，需要获取教练的 user_id
            const { data: coachUser } = await supabase
                .from('coaches')
                .select('user_id')
                .eq('id', conversation.coach_id)
                .single();
            
            if (!coachUser) {
                return NextResponse.json({
                    success: false,
                    message: '教练不存在',
                    data: null
                }, { status: 404 });
            }
            receiverId = coachUser.user_id;
        } else {
            return NextResponse.json({
                success: false,
                message: '无权在此会话中发送消息',
                data: null
            }, { status: 403 });
        }

        // 插入消息
        const { data: message, error } = await supabase
            .from('coach_messages')
            .insert({
                conversation_id,
                sender_id: userId,
                receiver_id: receiverId,
                message_type,
                content,
                media_url: media_url || null,
                file_name: file_name || null,
                file_size: file_size || null,
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
                message_id: message.id,
                created_at: message.created_at
            }
        });
    } catch (error: any) {
        console.error('发送消息错误:', error);
        return NextResponse.json({
            success: false,
            message: error?.message || '服务器错误',
            data: null
        }, { status: 500 });
    }
}

