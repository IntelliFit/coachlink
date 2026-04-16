'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import NotificationPermissionDialog from '@/components/notification/NotificationPermissionDialog';

type NotificationPermissionContextType = {
    isDialogOpen: boolean;
    openDialog: () => void;
    closeDialog: () => void;
};

const NotificationPermissionContext = createContext<NotificationPermissionContextType | undefined>(undefined);

export function NotificationPermissionProvider({ children }: { children: ReactNode }) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { data: session } = useSession();
    const { supported, permission } = usePushNotifications();
    const [hasShownOnce, setHasShownOnce] = useState(false);

    // 检查是否应该自动显示对话框（首次进入消息页且未授权）
    // 使用 localStorage 记录是否已显示过，避免每次刷新都弹出
    useEffect(() => {
        if (
            session?.user &&
            supported &&
            permission === 'default' &&
            typeof window !== 'undefined'
        ) {
            const hasShownBefore = localStorage.getItem('notification-dialog-shown') === 'true';
            if (hasShownBefore) {
                setHasShownOnce(true);
                return;
            }

            // 检查是否在消息页
            const path = window.location.pathname;
            const isMessagesPage = path === '/messages' || path.startsWith('/messages/');
            if (isMessagesPage) {
                // 延迟显示，避免与页面加载冲突
                const timer = setTimeout(() => {
                    setIsDialogOpen(true);
                    setHasShownOnce(true);
                    localStorage.setItem('notification-dialog-shown', 'true');
                }, 2000); // 2 秒后显示
                return () => clearTimeout(timer);
            }
        }
    }, [session?.user, supported, permission, hasShownOnce]);

    const openDialog = () => {
        setIsDialogOpen(true);
    };

    const closeDialog = () => {
        setIsDialogOpen(false);
    };

    return (
        <NotificationPermissionContext.Provider value={{ isDialogOpen, openDialog, closeDialog }}>
            {children}
            <NotificationPermissionDialog visible={isDialogOpen} onHide={closeDialog} />
        </NotificationPermissionContext.Provider>
    );
}

export function useNotificationPermission() {
    const context = useContext(NotificationPermissionContext);
    if (context === undefined) {
        throw new Error('useNotificationPermission must be used within a NotificationPermissionProvider');
    }
    return context;
}
