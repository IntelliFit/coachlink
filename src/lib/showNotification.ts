/**
 * 前端通知工具：通过 Service Worker 显示系统通知
 * 完全基于 PWA Notification API，不依赖后端推送
 * 
 * 注意：推荐使用 NotificationContext 中的 useNotification hook
 * 此文件保留用于向后兼容
 */

export interface NotificationPayload {
    title: string;
    body: string;
    icon?: string;
    url?: string;
    tag?: string;
    requireInteraction?: boolean;
    renotify?: boolean;
    actions?: Array<{
        action: string;
        title: string;
    }>;
}

/**
 * 通过 Service Worker 直接显示通知（使用 registration.showNotification）
 * 参考 swRegistration.ts 27-43 行的实现方式
 */
export async function showNotification(payload: NotificationPayload): Promise<void> {
    if (typeof window === 'undefined') {
        console.warn('[showNotification] 非浏览器环境，跳过通知');
        return;
    }

    // 检查通知权限
    if (!('Notification' in window)) {
        console.warn('[showNotification] 浏览器不支持通知');
        return;
    }

    if (Notification.permission !== 'granted') {
        console.log('[showNotification] 通知权限未授予，当前权限:', Notification.permission);
        return;
    }

    // 检查 Service Worker 支持
    if (!('serviceWorker' in navigator)) {
        console.warn('[showNotification] 浏览器不支持 Service Worker');
        return;
    }

    try {
        // 等待 Service Worker 就绪
        const registration = await navigator.serviceWorker.ready;
        if (!registration) {
            console.warn('[showNotification] Service Worker 未就绪');
            return;
        }

        console.log('[showNotification] 准备显示通知:', payload);

        // 直接使用 registration.showNotification（参考 swRegistration.ts 27-43 行）
        const notificationOptions: NotificationOptions = {
            body: payload.body || '',
            icon: payload.icon || '/icons/icon-192.png',
            badge: '/icons/icon-72.png',
            tag: payload.tag || 'default',
            data: {
                url: payload.url || '/messages',
            },
            requireInteraction: payload.requireInteraction ?? false,
            renotify: payload.renotify ?? false,
            silent: false,
        };

        // 如果提供了 actions，添加到选项中
        if (payload.actions && payload.actions.length > 0) {
            notificationOptions.actions = payload.actions;
        }

        await registration.showNotification(payload.title || 'CoachLink 通知', notificationOptions);

        console.log('[showNotification] ✅ 通知显示成功');
    } catch (error: any) {
        console.error('[showNotification] ❌ 显示通知失败:', {
            message: error?.message,
            stack: error?.stack,
            error,
        });
        throw error;
    }
}
