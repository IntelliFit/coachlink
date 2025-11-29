'use client';

import { Avatar } from 'primereact/avatar';
import { Badge } from 'primereact/badge';
import { Skeleton } from 'primereact/skeleton';
import type { ConversationItem } from '@/app/api/chat/get-conversations/entity';
import { useRouter } from 'next/navigation';

interface ConversationListProps {
    conversations: ConversationItem[];
    loading?: boolean;
    onConversationClick?: (conversation: ConversationItem) => void;
}

export function ConversationList({
    conversations,
    loading = false,
    onConversationClick
}: ConversationListProps) {
    const router = useRouter();

    const handleClick = (conversation: ConversationItem) => {
        if (onConversationClick) {
            onConversationClick(conversation);
        } else {
            router.push(`/messages/${conversation.id}`);
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

    if (loading) {
        return (
            <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="p-4 border-b border-surface-200 dark:border-surface-700">
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

    if (conversations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-surface-500">
                <i className="pi pi-comment text-4xl mb-4" />
                <p className="text-lg">暂无会话</p>
                <p className="text-sm">开始与教练的对话吧</p>
            </div>
        );
    }

    return (
        <div className="space-y-0">
            {conversations.map((conversation) => (
                <div
                    key={conversation.id}
                    className="p-4 border-b border-surface-200 dark:border-surface-700 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                    onClick={() => handleClick(conversation)}
                >
                    <div className="flex items-start gap-3">
                        <div className="relative">
                            <Avatar
                                image={conversation.coach_avatar || conversation.student_avatar || undefined}
                                label={
                                    !conversation.coach_avatar && !conversation.student_avatar
                                        ? (conversation.coach_name || conversation.student_name).charAt(0)
                                        : undefined
                                }
                                size="large"
                                shape="circle"
                                className="bg-primary-500 text-white"
                            />
                            {conversation.unread_count > 0 && (
                                <Badge
                                    value={conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                                    severity="danger"
                                    className="absolute -top-1 -right-1"
                                />
                            )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="font-semibold text-surface-900 dark:text-surface-0 truncate">
                                    {conversation.coach_name || conversation.student_name}
                                </h3>
                                <span className="text-xs text-surface-500 whitespace-nowrap ml-2">
                                    {formatTime(conversation.last_message_at)}
                                </span>
                            </div>
                            <p className={`text-sm truncate ${
                                conversation.unread_count > 0 
                                    ? 'text-surface-900 dark:text-surface-0 font-medium' 
                                    : 'text-surface-600 dark:text-surface-400'
                            }`}>
                                {conversation.last_message || '暂无消息'}
                            </p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}


