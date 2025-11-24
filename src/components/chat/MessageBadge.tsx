'use client';

import { useState, useEffect } from 'react';
import { Badge } from 'primereact/badge';
import { chatService } from '@/app/service/chatService';

interface MessageBadgeProps {
    className?: string;
}

export function MessageBadge({ className }: MessageBadgeProps) {
    const [unreadCount, setUnreadCount] = useState<number>(0);

    const fetchUnreadCount = async () => {
        try {
            const data = await chatService.getUnreadCount({});
            if (data) {
                setUnreadCount(data.total_unread);
            }
        } catch (error) {
            console.error('获取未读消息数失败:', error);
        }
    };

    useEffect(() => {
        fetchUnreadCount();
        
        // 定时刷新未读数（每30秒）
        const interval = setInterval(fetchUnreadCount, 30000);
        
        return () => clearInterval(interval);
    }, []);

    // 监听自定义事件来实时更新
    useEffect(() => {
        const handleUpdate = () => {
            fetchUnreadCount();
        };

        window.addEventListener('chat-unread-update', handleUpdate);
        return () => window.removeEventListener('chat-unread-update', handleUpdate);
    }, []);

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

