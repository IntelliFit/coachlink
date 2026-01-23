'use client';

import { Badge } from 'primereact/badge';
import { useChatContext } from '@/context/ChatContext';

interface MessageBadgeProps {
    className?: string;
}

export function MessageBadge({ className }: MessageBadgeProps) {
    // 直接从 Context 获取未读数，不需要自己建立连接
    const { unreadCount } = useChatContext();

    if (unreadCount === 0) {
        return null;
    }

    return (
        <Badge 
            value={unreadCount > 99 ? '99+' : unreadCount}
            severity="danger" 
            className={className}
        />
    );
}


