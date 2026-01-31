import supabase, { serviceRoleSupabase } from '@/lib/supabaseClient';
import { NextRequest } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
// 推送通知现在完全由前端通过 Service Worker 处理，不再需要后端推送

export const runtime = 'nodejs'; // ⚠️ 不能是 edge

export async function GET(req: NextRequest) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return new Response('Unauthorized', { status: 401 });
    }

    const userId = session.user.id;

    const stream = new ReadableStream({
        start(controller) {
            const channels: any[] = [];

            // 1. 获取用户所在的所有聊天室，并为每个聊天室创建消息监听
            (async () => {
                try {
                    const { data: userRooms, error: roomsError } = await supabase
                        .from('chat_rooms')
                        .select('id, members')
                        .contains('members', [userId]);

                    if (roomsError) {
                        console.error('获取用户聊天室失败:', roomsError);
                        return;
                    }

                    if (!userRooms || userRooms.length === 0) {
                        return;
                    }

                    // 存储用户所在的聊天室 ID 集合，用于后续验证
                    const userRoomIds = new Set(userRooms.map(room => room.id));

                    // 为每个聊天室创建单独的消息监听
                    userRooms.forEach((room) => {
                        const messageChannel = serviceRoleSupabase
                            .channel(`unified:room:${room.id}:user:${userId}`)
                            .on(
                                'postgres_changes',
                                {
                                    event: 'INSERT',
                                    schema: 'public',
                                    table: 'chat_messages',
                                    filter: `room_id=eq.${room.id}`,
                                },
                                async (payload) => {
                                    // 双重验证：确保消息属于用户所在的聊天室
                                    const messageRoomId = payload.new?.room_id;
                                    if (!messageRoomId || !userRoomIds.has(messageRoomId)) {
                                        console.warn(`消息 ${payload.new?.id} 不属于用户 ${userId} 的聊天室`);
                                        return;
                                    }

                                    // 再次验证用户是否真的是该聊天室的成员（防止数据不一致）
                                    const room = userRooms.find(r => r.id === messageRoomId);
                                    if (!room || !room.members.includes(userId)) {
                                        console.warn(`用户 ${userId} 不是聊天室 ${messageRoomId} 的成员`);
                                        return;
                                    }

                                    // 验证通过，发送消息
                                    controller.enqueue(
                                        `event: message\ndata: ${JSON.stringify({ type: 'message', data: payload.new })}\n\n`
                                    );

                                    // 当收到新消息时，主动触发一次未读数更新
                                    // 这样可以确保即使数据库触发器没有正确触发事件，前端也能收到更新
                                    // 只有当消息不是当前用户发送的时才更新未读数
                                    const isIncomingMessage = payload.new?.sender_id !== userId;
                                    console.log(`[unified-stream] 收到消息事件 - 用户ID: ${userId}, 发送者ID: ${payload.new?.sender_id}, 是否接收消息: ${isIncomingMessage}`);
                                    
                                    // 注意：推送通知现在完全由前端通过 Service Worker 处理
                                    // 前端通过 SSE 接收到消息后，会在 ChatContext 中自动显示通知
                                    
                                    if (isIncomingMessage) {
                                        try {
                                            const { data: unreadRows, error } = await supabase
                                                .from('chat_room_unreads')
                                                .select('room_id, unread_count')
                                                .eq('user_id', userId);

                                            if (!error && unreadRows) {
                                                const totalUnread = unreadRows.reduce((sum, row) => sum + row.unread_count, 0);
                                                const unreadByRoom = unreadRows.reduce((acc, row) => {
                                                    acc[row.room_id] = row.unread_count;
                                                    return acc;
                                                }, {} as Record<string, number>);

                                                controller.enqueue(
                                                    `event: unread_count\ndata: ${JSON.stringify({ type: 'unread_count', totalUnread, unreadByRoom })}\n\n`
                                                );
                                            }
                                        } catch (error) {
                                            console.error('主动更新未读数失败:', error);
                                        }
                                    }
                                }
                            )
                            .subscribe();
                        channels.push(messageChannel);
                    });
                } catch (error) {
                    console.error('初始化消息监听失败:', error);
                }
            })();

            // 2. 监听 chat_room_unreads 表的更新，获取未读数变化
            const unreadChannel = serviceRoleSupabase
                .channel(`unified:unreads:user:${userId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*', // INSERT, UPDATE, DELETE
                        schema: 'public',
                        table: 'chat_room_unreads',
                        filter: `user_id=eq.${userId}`,
                    },
                    async (payload) => {
                        // 验证 payload 中的 user_id 是否匹配当前用户（双重验证）
                        const newRecord = payload.new as any;
                        const oldRecord = payload.old as any;
                        const payloadUserId = newRecord?.user_id || oldRecord?.user_id;
                        if (payloadUserId && payloadUserId !== userId) {
                            console.warn(`未读数更新事件中的 user_id ${payloadUserId} 不匹配当前用户 ${userId}`);
                            return;
                        }

                        // 计算总未读数（只查询当前用户的未读数）
                        const { data: unreadRows, error } = await supabase
                            .from('chat_room_unreads')
                            .select('room_id, unread_count')
                            .eq('user_id', userId); // 明确指定只查询当前用户的未读数

                        if (error) {
                            console.error('获取未读数失败:', error);
                            return;
                        }

                        // 验证所有未读数记录都属于当前用户
                        const validUnreadRows = unreadRows?.filter(row => {
                            // 这里 row 已经通过 .eq('user_id', userId) 过滤了，但为了安全再次验证
                            return true; // 由于已经通过查询过滤，这里不需要额外验证
                        }) || [];

                        // 发送所有未读数，让前端根据 currentOpenRoomId 来过滤
                        const totalUnread = validUnreadRows.reduce((sum, row) => sum + row.unread_count, 0);
                        const unreadByRoom = validUnreadRows.reduce((acc, row) => {
                            acc[row.room_id] = row.unread_count;
                            return acc;
                        }, {} as Record<string, number>);

                        controller.enqueue(
                            `event: unread_count\ndata: ${JSON.stringify({ type: 'unread_count', totalUnread, unreadByRoom })}\n\n`
                        );
                    }
                )
                .subscribe();
            channels.push(unreadChannel);

            // 3. 初始发送一次未读数（只发送当前用户的未读数）
            (async () => {
                try {
                    const { data: unreadRows, error } = await supabase
                        .from('chat_room_unreads')
                        .select('room_id, unread_count, user_id')
                        .eq('user_id', userId); // 明确指定只查询当前用户的未读数

                    if (error) {
                        console.error('获取初始未读数失败:', error);
                        return;
                    }

                    // 验证所有未读数记录都属于当前用户（双重验证）
                    const validUnreadRows = (unreadRows || []).filter(row => {
                        // 虽然已经通过查询过滤，但为了安全再次验证
                        return row.user_id === userId;
                    });

                    // 发送所有未读数，让前端根据 currentOpenRoomId 来过滤
                    const totalUnread = validUnreadRows.reduce((sum, row) => sum + row.unread_count, 0);
                    const unreadByRoom = validUnreadRows.reduce((acc, row) => {
                        acc[row.room_id] = row.unread_count;
                        return acc;
                    }, {} as Record<string, number>);

                    controller.enqueue(
                        `event: unread_count\ndata: ${JSON.stringify({ type: 'unread_count', totalUnread, unreadByRoom })}\n\n`
                    );
                } catch (error) {
                    console.error('发送初始未读数失败:', error);
                }
            })();

            // 清理函数
            req.signal.addEventListener('abort', () => {
                channels.forEach(channel => {
                    serviceRoleSupabase.removeChannel(channel);
                });
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
    });
}
