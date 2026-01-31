'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useNotification } from '@/context/NotificationContext';
import { userService } from '@/app/service/userService';

interface ChatContextType {
    currentOpenRoomId: string | null;
    setCurrentOpenRoomId: (roomId: string | null) => void;
    unreadCount: number;
    subscribeToMessages: (callback: (message: any) => void) => () => void;
    markRoomAsRead: (roomId: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
    const [currentOpenRoomId, setCurrentOpenRoomId] = useState<string | null>(null);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const eventSourceRef = useRef<EventSource | null>(null);
    const messageCallbacksRef = useRef<Set<(message: any) => void>>(new Set());
    const unreadByRoomRef = useRef<Record<string, number>>({});
    const userInfoCacheRef = useRef<Record<string, { nickname?: string; full_name?: string }>>({});
    const { data: session } = useSession();
    const { showNotification } = useNotification();

    // 计算未读数的辅助函数
    const calculateUnreadCount = useCallback(() => {
        const unreadByRoom = unreadByRoomRef.current;
        let total = 0;
        for (const [roomId, count] of Object.entries(unreadByRoom)) {
            // 排除当前打开的聊天室
            if (roomId !== currentOpenRoomId) {
                total += count;
            }
        }
        setUnreadCount(total);
    }, [currentOpenRoomId]);

    // 管理全局 SSE 连接（只建立一次，不随 currentOpenRoomId 变化）
    useEffect(() => {
        if (!session?.user?.id) {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            return;
        }

        // 如果连接已存在，不重复建立
        if (eventSourceRef.current) {
            return;
        }

        // 建立全局连接，监听所有与用户相关的消息
        const es = new EventSource('/api/chat/unified-stream');
        eventSourceRef.current = es;

        // 处理消息事件（所有与用户相关的消息）
        es.addEventListener('message', (event) => {
            try {
                const parsed = JSON.parse(event.data);
                if (parsed.type === 'message') {
                    const messageData = parsed.data;
                    const userId = session?.user?.id;
                    
                    // 如果是接收到的消息（不是自己发送的），且不在当前打开的聊天室，显示通知
                    if (userId && messageData.sender_id !== userId) {
                        const messageRoomId = messageData.room_id;
                        const senderId = messageData.sender_id;
                        const isCurrentRoom = messageRoomId === currentOpenRoomId;
                        
                        if (!isCurrentRoom) {
                            console.log('[ChatContext] 收到新消息，准备显示通知:', {
                                roomId: messageRoomId,
                                senderId,
                                currentRoom: currentOpenRoomId,
                            });
                            
                            // 获取消息内容
                            const messageContent = messageData.content || '';
                            const messageType = messageData.message_type || 'text';
                            let body = messageContent;
                            if (messageType === 'image') body = '[图片]';
                            else if (messageType === 'video_reference') body = '[视频]';
                            else if (messageType === 'file') body = '[文件]';
                            
                            // 获取发送者名称（从缓存或异步获取）
                            let senderName = '新消息';
                            
                            const cachedUser = userInfoCacheRef.current[senderId];
                            if (cachedUser) {
                                senderName = cachedUser.nickname || cachedUser.full_name || '新消息';
                            } else {
                                // 异步获取用户信息（不阻塞通知显示）
                                userService.getProfile({ userId: senderId }).then((res) => {
                                    if (res?.profile) {
                                        userInfoCacheRef.current[senderId] = {
                                            nickname: res.profile.nickname,
                                            full_name: res.profile.full_name,
                                        };
                                    }
                                }).catch((error) => {
                                    console.warn('[ChatContext] 获取发送者信息失败:', error);
                                });
                            }
                            
                            // 显示通知（异步，不阻塞）
                            showNotification({
                                title: senderName,
                                body: body.slice(0, 80),
                                url: `/messages?peerUserId=${senderId}`,
                                tag: `chat-${messageRoomId}`,
                            }).catch((error) => {
                                console.error('[ChatContext] 显示通知失败:', error);
                            });
                        } else {
                            console.log('[ChatContext] 消息来自当前打开的聊天室，不显示通知');
                        }
                    }
                    
                    // 通知所有订阅者
                    messageCallbacksRef.current.forEach(callback => {
                        callback(messageData);
                    });
                }
            } catch (error) {
                console.error('解析消息失败:', error);
            }
        });

        // 处理未读数更新事件
        es.addEventListener('unread_count', (event) => {
            try {
                const parsed = JSON.parse(event.data);
                if (parsed.type === 'unread_count') {
                    // 更新未读数映射
                    unreadByRoomRef.current = parsed.unreadByRoom || {};
                    // 重新计算未读数（会排除当前打开的聊天室）
                    calculateUnreadCount();
                }
            } catch (error) {
                console.error('解析未读数失败:', error);
            }
        });

        // 处理错误
        es.onerror = (error) => {
            console.error('SSE 连接错误:', error);
        };

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
        };
    }, [session?.user?.id, currentOpenRoomId]); // 依赖 currentOpenRoomId 以便在消息处理时判断

    // 当 currentOpenRoomId 变化时，重新计算未读数
    useEffect(() => {
        calculateUnreadCount();
    }, [currentOpenRoomId, calculateUnreadCount]);

    // 订阅消息事件的函数
    const subscribeToMessages = useCallback((callback: (message: any) => void) => {
        messageCallbacksRef.current.add(callback);
        return () => {
            messageCallbacksRef.current.delete(callback);
        };
    }, []);

    // 标记聊天室为已读，立即更新未读数（不等待 SSE 事件）
    const markRoomAsRead = useCallback((roomId: string) => {
        // 立即将该聊天室的未读数设为 0
        unreadByRoomRef.current[roomId] = 0;
        // 重新计算未读数（会排除当前打开的聊天室）
        calculateUnreadCount();
    }, [calculateUnreadCount]);

    return (
        <ChatContext.Provider value={{ 
            currentOpenRoomId, 
            setCurrentOpenRoomId, 
            unreadCount,
            subscribeToMessages,
            markRoomAsRead
        }}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChatContext() {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChatContext must be used within a ChatProvider');
    }
    return context;
}
