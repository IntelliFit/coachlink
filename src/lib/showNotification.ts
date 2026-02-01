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
 * 兼容 Safari：Notification.requestPermission 既可能返回 Promise，也可能使用 callback 形式
 * 参考：https://pwa.alienzhou.com/7-shi-yong-notification-api-lai-jin-hang-xiao-xi-ti-xing
 */
async function requestNotificationPermissionCompat(): Promise<NotificationPermission> {
    return await new Promise<NotificationPermission>((resolve, reject) => {
        try {
            // 旧版 Safari/Chromium：允许传 callback
            const maybePromise = (Notification as any).requestPermission((result: NotificationPermission) => {
                resolve(result);
            });

            // 新版：返回 Promise
            if (maybePromise && typeof (maybePromise as any).then === 'function') {
                (maybePromise as Promise<NotificationPermission>).then(resolve).catch(reject);
            }
        } catch (e) {
            reject(e);
        }
    });
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

    try {
        // 权限兜底：如果是 default，则尝试请求一次（注意：iOS 需要用户手势触发）
        // denied 则直接返回
        if (Notification.permission !== 'granted') {
            if (Notification.permission === 'default') {
                const newPerm = await requestNotificationPermissionCompat();
                if (newPerm !== 'granted') {
                    console.log('[showNotification] 未获得通知授权，当前权限:', newPerm);
                    return;
                }
            } else {
                console.log('[showNotification] 通知权限未授予，当前权限:', Notification.permission);
                return;
            }
        }

        console.log('[showNotification] 准备显示通知:', payload);

        const notificationOptions: NotificationOptions & {
            badge?: string;
            renotify?: boolean;
            actions?: Array<{
                action: string;
                title: string;
            }>;
        } = {
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

        const title = payload.title || 'CoachLink 通知';
        const url = payload.url || '/messages';

        const ua = navigator.userAgent || '';
        const isSafari =
            /Safari/i.test(ua) &&
            !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);

        // Safari（参考文章）：优先使用页面上下文 Notification 构造函数
        // 如果构造失败（比如 iOS 未安装到主屏 / 不支持），再回退到 SW showNotification
        if (isSafari) {
            try {
                const notification = new Notification(title, notificationOptions);
                notification.onclick = () => {
                    try {
                        notification.close?.();
                    } catch {
                        // ignore
                    }
                    window.location.assign(url);
                };
                console.log('[showNotification] ✅ 通知显示成功（Safari Window Notification）');
                return;
            } catch (e) {
                console.warn('[showNotification] Safari Notification 构造失败，回退到 Service Worker:', e);
            }
        }

        // 优先走 SW 注册的 showNotification（更稳定 + 可配合 sw.js 的 notificationclick 聚焦/跳转）
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready.catch(() => null);
            if (registration && 'showNotification' in registration && typeof registration.showNotification === 'function') {
                await registration.showNotification(title, notificationOptions);
                console.log('[showNotification] ✅ 通知显示成功（Service Worker）');
                return;
            }
        }

        // Safari（尤其移动端）可能不支持 registration.showNotification，此处退化为页面上下文 Notification 构造函数
        // 参考：https://pwa.alienzhou.com/7-shi-yong-notification-api-lai-jin-hang-xiao-xi-ti-xing
        const notification = new Notification(title, notificationOptions);
        notification.onclick = () => {
            try {
                notification.close?.();
            } catch {
                // ignore
            }
            // 同 tab 跳转更符合 iOS 行为预期
            window.location.assign(url);
        };

        console.log('[showNotification] ✅ 通知显示成功（Window Notification）');
    } catch (error: any) {
        console.error('[showNotification] ❌ 显示通知失败:', {
            message: error?.message,
            stack: error?.stack,
            error,
        });
        throw error;
    }
}
