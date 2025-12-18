'use client';

import { Avatar } from 'primereact/avatar';
import { Badge } from 'primereact/badge';
import { Skeleton } from 'primereact/skeleton';
import type { ChatroomItem } from '@/app/api/chat/list-chatrooms/entity';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import React, { useState } from 'react';
import ChatDialog from '@/components/chat/ChatDialog';
import { ChatroomDetail } from '@/app/api/chat/get-chatroom/entity';
import MarkdownIt from 'markdown-it';

interface ConversationListProps {
    chatrooms: ChatroomItem[];
    loading?: boolean;
    onConversationClick?: (room: ChatroomItem) => void;
}

export function ConversationList({
    chatrooms,
    loading = false,
    onConversationClick
}: ConversationListProps) {
    const router = useRouter();
    const { data: session } = useSession();
    const userId = session?.user?.id;
    const [chatDialogVisible, setChatDialogVisible] = useState(false);
    const [currentCoachId, setCurrentCoachId] = useState<string | null>(null);
    const [currentChatroom, setCurrentChatroom] = useState<ChatroomDetail | null>(null);
    const [chatroomState, setChatroomState] = useState<ChatroomItem[]>(chatrooms);

    // 保持 chatrooms prop 变化时同步
    React.useEffect(() => {
        setChatroomState(chatrooms);
    }, [chatrooms]);

    const handleMarkSuccess = (roomId: string) => {
        setChatroomState(prev => prev.map(room =>
            room.id === roomId
                ? { ...room, unreadCount: 0, unreadMembers: room.unreadMembers.filter(id => id !== userId) }
                : room
        ));
        // 通知 MessageBadge 组件刷新
        window.dispatchEvent(new Event('chat-unread-update'));
    };

    const handleClick = (room: ChatroomItem) => {
        if (onConversationClick) {
            onConversationClick(room);
        } else {
            setCurrentCoachId(room.chatUserId);
            setCurrentChatroom({
                id: room.id,
                members: [room.chatUserId, session.user.id],
                lastMessage: room.lastMessage,
                lastMessageAt: room.lastMessageAt,
                unreadMembers: room.unreadMembers,
                isArchived: room.isArchived,
            });
            setChatDialogVisible(true);
        }
    };

    const formatTime = (dateStr: string | null) => {
        if (!dateStr) return '';
        
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) {
            return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        } else if (days === 1) {
            return '昨天';
        } else if (days < 7) {
            return `${days}天前`;
        } else {
            return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
        }
    };

    const md = React.useMemo(() => new MarkdownIt({ html: false, linkify: false, typographer: false }), []);
    const getPlainTextFromMarkdown = (markdown: string) => {
        // 只提取纯文本内容
        const html = md.render(markdown || '');
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    };

    if (loading) {
        return (
            <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="p-4 border-b border-surface-200">
                        <div className="flex items-center gap-3">
                            <Skeleton shape="circle" size="3rem" />
                            <div className="flex-1">
                                <Skeleton width="60%" height="1.2rem" className="mb-2" />
                                <Skeleton width="80%" height="0.8rem" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (chatrooms.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-surface-500">
                <i className="pi pi-comment text-4xl mb-4" />
                <p className="text-lg">暂无会话</p>
                <p className="text-sm">开始与教练的对话吧</p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-0">
                {chatroomState.map((room) => (
                    <div
                        key={room.id}
                        className="p-4 border-b border-surface-200 cursor-pointer hover:bg-surface-100 transition-colors"
                        onClick={() => handleClick(room)}
                    >
                        <div className="flex items-start gap-3">
                            <div className="relative">
                                <Avatar
                                    image={room.chatUserProfile.avatar}
                                    label={room.chatUserProfile.name?.charAt(0)}
                                    size="large"
                                    shape="circle"
                                    className="bg-primary-500 text-white"
                                />
                                {room.unreadCount > 0 && (
                                    <Badge
                                        severity="danger"
                                        className="absolute -top-1 -right-1"
                                        value={room.unreadCount > 99 ? '99+' : room.unreadCount}
                                    />
                                )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="font-semibold text-surface-900 truncate">
                                        {room.chatUserProfile.name}
                                    </h3>
                                    <span className="text-xs text-surface-500 whitespace-nowrap ml-2">
                                        {formatTime(room.lastMessageAt)}
                                    </span>
                                </div>
                                <p className={`text-sm truncate ${
                                    room.unreadMembers.includes(userId)
                                        ? 'text-surface-900 dark:text-surface-0 font-medium' 
                                        : 'text-surface-600 dark:text-surface-400'
                                }`} title={room.lastMessage ? getPlainTextFromMarkdown(room.lastMessage) : '暂无消息'}>
                                    {room.lastMessage ? getPlainTextFromMarkdown(room.lastMessage) : '暂无消息'}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <ChatDialog
                visible={chatDialogVisible}
                chatroom={currentChatroom}
                onHide={() => setChatDialogVisible(false)}
                onMarkSuccess={handleMarkSuccess}
            />
        </>
    );
}


