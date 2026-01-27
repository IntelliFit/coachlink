'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { useSession } from 'next-auth/react';

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
    const { data: session } = useSession();

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
                    // 通知所有订阅者
                    messageCallbacksRef.current.forEach(callback => {
                        callback(parsed.data);
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
    }, [session?.user?.id]); // 只在用户登录时建立连接，不随 currentOpenRoomId 变化

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
