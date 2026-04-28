'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { registerSw, getNotificationPermission, requestPermissionAndSubscribe, isPushSupported } from '@/lib/swRegistration';

export interface NotificationPayload {
    title: string;
    body: string;
    icon?: string;
    url?: string;
    tag?: string;
    requireInteraction?: boolean;
    renotify?: boolean;
    data?: Record<string, unknown>;
    actions?: Array<{
        action: string;
        title: string;
    }>;
}

interface NotificationContextType {
    registration: ServiceWorkerRegistration | null;
    permission: 'default' | 'granted' | 'denied';
    supported: boolean;
    showNotification: (payload: NotificationPayload) => Promise<void>;
    requestPermission: () => Promise<{ ok: boolean; reason?: string }>;
    loading: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [permission, setPermission] = useState<'default' | 'granted' | 'denied'>('default');
    const [supported, setSupported] = useState(false);
    const [loading, setLoading] = useState(true);

    // 初始化：注册 Service Worker 并检查权限
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            
            // 检查是否支持通知
            const isSupported = isPushSupported();
            setSupported(isSupported);
            
            if (!isSupported) {
                console.log('[NotificationContext] 浏览器不支持通知功能');
                setLoading(false);
                return;
            }

            // 检查当前权限状态
            const currentPermission = getNotificationPermission();
            setPermission(currentPermission);
            console.log('[NotificationContext] 当前通知权限:', currentPermission);

            // 注册 Service Worker
            try {
                const reg = await registerSw();
                if (reg) {
                    setRegistration(reg);
                    console.log('[NotificationContext] Service Worker 注册成功');
                } else {
                    console.warn('[NotificationContext] Service Worker 注册失败');
                }
            } catch (error) {
                console.error('[NotificationContext] Service Worker 注册异常:', error);
            } finally {
                setLoading(false);
            }
        };

        init();
    }, []);

    // 监听权限变化
    useEffect(() => {
        if (typeof window === 'undefined' || !('Notification' in window)) return;

        const checkPermission = () => {
            const currentPermission = getNotificationPermission();
            setPermission(currentPermission);
        };

        // 定期检查权限（某些浏览器可能不支持权限变化事件）
        const interval = setInterval(checkPermission, 1000);
        
        return () => clearInterval(interval);
    }, []);

    // 显示通知（直接使用 registration.showNotification）
    const showNotification = useCallback(async (payload: NotificationPayload): Promise<void> => {
        if (typeof window === 'undefined') {
            console.warn('[NotificationContext] 非浏览器环境，跳过通知');
            return;
        }

        // 检查通知权限
        if (!('Notification' in window)) {
            console.warn('[NotificationContext] 浏览器不支持通知');
            return;
        }

        if (Notification.permission !== 'granted') {
            console.log('[NotificationContext] 通知权限未授予，当前权限:', Notification.permission);
            return;
        }

        // 检查 Service Worker 支持
        if (!('serviceWorker' in navigator)) {
            console.warn('[NotificationContext] 浏览器不支持 Service Worker');
            return;
        }

        try {
            // 等待 Service Worker 就绪
            const reg = registration || await navigator.serviceWorker.ready;
            if (!reg) {
                console.warn('[NotificationContext] Service Worker 未就绪');
                return;
            }

            console.log('[NotificationContext] 准备显示通知:', payload);

            // 直接使用 registration.showNotification（参考 swRegistration.ts 27-43 行的注释代码）
            const notificationOptions: NotificationOptions & {
                badge?: string;
                data?: Record<string, unknown>;
                renotify?: boolean;
                actions?: Array<{ action: string; title: string }>;
            } = {
                body: payload.body || '',
                icon: payload.icon || '/icons/icon-192.png',
                badge: '/icons/icon-72.png',
                tag: payload.tag || 'default',
                data: {
                    url: payload.url || '/messages',
                    ...(payload.data || {}),
                },
                requireInteraction: payload.requireInteraction ?? false,
                renotify: payload.renotify ?? false,
                silent: false,
            };

            // 如果提供了 actions，添加到选项中
            if (payload.actions && payload.actions.length > 0) {
                notificationOptions.actions = payload.actions;
            }

            await reg.showNotification(payload.title || 'CoachLink 通知', notificationOptions);

            console.log('[NotificationContext] ✅ 通知显示成功');
        } catch (error: any) {
            console.error('[NotificationContext] ❌ 显示通知失败:', {
                message: error?.message,
                stack: error?.stack,
                error,
            });
            throw error;
        }
    }, [registration]);

    // 请求通知权限
    const requestPermission = useCallback(async (): Promise<{ ok: boolean; reason?: string }> => {
        const result = await requestPermissionAndSubscribe();
        if (result.ok) {
            setPermission('granted');
        }
        return result;
    }, []);

    return (
        <NotificationContext.Provider
            value={{
                registration,
                permission,
                supported,
                showNotification,
                requestPermission,
                loading,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
}
