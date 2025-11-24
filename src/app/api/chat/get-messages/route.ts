import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import type { ApiData } from '@/types/api';
import type { GetMessagesDto, GetMessagesResponseDto, MessageItem } from './entity';
import supabase from '@/lib/supabaseClient';

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
    const { conversation_id, page = 1, limit = 50, before_id } = await req.json() as GetMessagesDto;

    if (!conversation_id) {
        return NextResponse.json({
            success: false,
            message: '缺少会话ID',
            data: null
        }, { status: 400 });
    }

    try {
        // 验证用户是否为会话参与者
        const { data: conversation, error: conversationError } = await supabase
            .from('conversations')
            .select('student_id, coach_id')
            .eq('id', conversation_id)
            .single();

        if (conversationError || !conversation) {
            return NextResponse.json({
                success: false,
                message: '会话不存在',
                data: null
            }, { status: 404 });
        }

        // 检查是否为教练
        const { data: coachData } = await supabase
            .from('coaches')
            .select('id')
            .eq('user_id', userId)
            .single();

        const isParticipant = 
            conversation.student_id === userId || 
            (coachData && conversation.coach_id === coachData.id);

        if (!isParticipant) {
            return NextResponse.json({
                success: false,
                message: '无权访问此会话',
                data: null
            }, { status: 403 });
        }

        // 查询消息
        let query = supabase
            .from('coach_messages')
            .select('*', { count: 'exact' })
            .eq('conversation_id', conversation_id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (before_id) {
            // 加载更早的消息
            const { data: beforeMsg } = await supabase
                .from('coach_messages')
                .select('created_at')
                .eq('id', before_id)
                .single();
            
            if (beforeMsg) {
                query = query.lt('created_at', beforeMsg.created_at);
            }
        }

        const { data: messages, error, count } = await query;

        if (error) {
            console.error('查询消息失败:', error);
            return NextResponse.json({
                success: false,
                message: '获取消息失败',
                data: null
            }, { status: 500 });
        }

        if (!messages || messages.length === 0) {
            return NextResponse.json<ApiData<GetMessagesResponseDto>>({
                success: true,
                message: '暂无消息',
                data: {
                    messages: [],
                    has_more: false,
                    total: 0
                }
            });
        }

        // 获取发送者信息
        const senderIds = [...new Set(messages.map(m => m.sender_id))];
        
        const { data: profiles } = await supabase
            .from('user_profiles')
            .select('user_id, nickname, avatar_url')
            .in('user_id', senderIds);

        const { data: coaches } = await supabase
            .from('coaches')
            .select('user_id, name, avatar_url')
            .in('user_id', senderIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        const coachMap = new Map(coaches?.map(c => [c.user_id, c]) || []);

        // 组装消息数据
        const enrichedMessages: MessageItem[] = messages.map(msg => {
            const profile = profileMap.get(msg.sender_id);
            const coach = coachMap.get(msg.sender_id);
            
            return {
                id: msg.id,
                sender_id: msg.sender_id,
                receiver_id: msg.receiver_id,
                message_type: msg.message_type,
                content: msg.content,
                media_url: msg.media_url,
                file_name: msg.file_name,
                file_size: msg.file_size,
                duration: msg.duration,
                is_read: msg.is_read,
                created_at: msg.created_at,
                sender_name: coach?.name || profile?.nickname || '用户',
                sender_avatar: coach?.avatar_url || profile?.avatar_url || null,
                is_mine: msg.sender_id === userId
            };
        }).reverse(); // 倒序，最新消息在最后

        return NextResponse.json<ApiData<GetMessagesResponseDto>>({
            success: true,
            message: '获取消息成功',
            data: {
                messages: enrichedMessages,
                has_more: messages.length === limit,
                total: count || 0
            }
        });
    } catch (error: any) {
        console.error('获取消息错误:', error);
        return NextResponse.json({
            success: false,
            message: error?.message || '服务器错误',
            data: null
        }, { status: 500 });
    }
}

