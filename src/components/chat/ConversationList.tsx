'use client';

import { Avatar } from 'primereact/avatar';
import { Badge } from 'primereact/badge';
import { Skeleton } from 'primereact/skeleton';
import type { ChatroomItem } from '@/app/api/chat/list-chatrooms/entity';
import { useSession } from 'next-auth/react';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import MarkdownIt from 'markdown-it';
import { Clock, ChevronRight, MessageSquareText } from 'lucide-react';
import { diffBeijingCalendarDays, formatBeijingDate } from '@/lib/beijingTime';
import { getConversationPreview } from '@/lib/chatPreview';

export function ConversationList({
    chatrooms,
    loading = false,
    onConversationClick,
    selectedRoomId,
}: {
    chatrooms: ChatroomItem[];
    loading?: boolean;
    onConversationClick?: (room: ChatroomItem) => void;
    selectedRoomId?: string | null;
}) {
    const router = useRouter();
    const { data: session } = useSession();
    const userId = session?.user?.id;
    const [chatroomState, setChatroomState] = useState<ChatroomItem[]>(chatrooms);

    React.useEffect(() => setChatroomState(chatrooms), [chatrooms]);

    const handleClick = (room: ChatroomItem) => {
        if (onConversationClick) {
            onConversationClick(room);
        } else {
            router.push(`/messages/${encodeURIComponent(room.id)}`);
        }
    };

    const formatTime = (dateStr: string | null) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const days = diffBeijingCalendarDays(new Date(), date);
        if (days === 0) return formatBeijingDate(date, 'zh-CN', { hour: '2-digit', minute: '2-digit' });
        if (days === 1) return '昨天';
        return days < 7 ? `${days}天前` : formatBeijingDate(date, 'zh-CN', { month: '2-digit', day: '2-digit' });
    };

    const md = React.useMemo(() => new MarkdownIt({ html: false }), []);
    const getPlainText = (markdown: string) => {
        if (!markdown) return '暂无消息';
        const html = md.render(markdown);
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    };

    if (loading) {
        return (
            <div className="p-2 space-y-1">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-3xl bg-surface-50/50">
                        <Skeleton shape="circle" size="3.5rem" />
                        <div className="flex-1">
                            <Skeleton width="40%" height="1rem" className="mb-3" />
                            <Skeleton width="80%" height="0.8rem" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (chatrooms.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-surface-400">
                <div className="w-20 h-20 bg-surface-50 rounded-full flex items-center justify-center mb-4 text-surface-200">
                    <MessageSquareText size={40} />
                </div>
                <p className="font-bold text-surface-900">暂无会话</p>
                <p className="text-sm">开始与教练进行第一次沟通吧</p>
            </div>
        );
    }

    return (
        <div className="p-2">
            {chatroomState.map((room) => {
                const isUnread = room.unreadMembers.includes(userId as string);
                return (
                    <div
                        key={room.id}
                        className={`group flex items-center gap-4 p-4 rounded-[1.5rem] cursor-pointer transition-all duration-300 hover:bg-primary-50/50 active:scale-[0.99] ${
                            selectedRoomId && room.id === selectedRoomId
                                ? 'bg-primary-50/80 ring-2 ring-primary-200'
                                : ''
                        }`}
                        onClick={() => handleClick(room)}
                    >
                        {/* 头像区 */}
                        <div className="relative">
                            <Avatar
                                image={room.chatUserProfile.avatar}
                                label={room.chatUserProfile.name?.charAt(0)}
                                shape="circle"
                                className="w-14 h-14 bg-primary-500 text-white font-bold shadow-sm"
                            />
                            {room.unreadCount > 0 && (
                                <div className="absolute -top-1 -right-1 flex items-center justify-center h-6 min-w-[24px] px-1.5 bg-rose-500 text-white text-[10px] font-black rounded-full border-2 border-white shadow-sm animate-in zoom-in">
                                    {room.unreadCount > 99 ? '99+' : room.unreadCount}
                                </div>
                            )}
                        </div>

                        {/* 内容区 */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-base font-bold text-surface-900 truncate tracking-tight">
                                    {room.chatUserProfile.name}
                                </h3>
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-surface-400 whitespace-nowrap ml-2">
                                    <Clock size={12} />
                                    {formatTime(room.lastMessageAt)}
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <p
                                    className={`text-sm line-clamp-2 break-words ${isUnread ? 'text-surface-900 font-bold italic' : 'text-surface-500 font-medium'}`}
                                >
                                    {getConversationPreview(getPlainText(room.lastMessage))}
                                </p>
                                <ChevronRight size={16} className="text-surface-200 group-hover:text-primary-300 group-hover:translate-x-1 transition-all" />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
