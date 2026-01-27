/**
 * Service Worker 注册与通知权限管理
 * 兼容 Android 常见浏览器与 iOS Safari 16.4+
 *
 * 注意：
 * - iOS 要求权限请求必须由用户手势触发（如点击按钮）
 * - 推送通知现在完全由前端通过 Service Worker postMessage API 处理
 * - 不再需要 Web Push API 订阅或后端推送服务
 */

const SW_URL = '/sw.js';
const SW_SCOPE = '/';

export type PushPermission = 'default' | 'granted' | 'denied';

/** 仅注册 SW，不请求权限。可在页面加载时调用。 */
export async function registerSw(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        console.log('[SW] 环境不支持 Service Worker');
        return null;
    }
    try {
        console.log('[SW] 开始注册 Service Worker...');
        const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
        console.log('[SW] 注册成功，scope:', reg.scope);        

        // reg.showNotification(
        //     'SHOW_NOTIFICATION',
        //     {
        //         body: '测试基本功能',
        //         icon: '/favicon.jpg',
        //         tag: 'pwa-starter',
        //         requireInteraction: true,
        //         renotify: true,
        //         actions: [{
        //             action: 'show-book',
        //             title: '去看看'
        //         }, {
        //             action: 'contact-me',
        //             title: '联系我'
        //         }],
        //     }
        // )
        
        // 监听 Service Worker 状态变化
        reg.addEventListener('updatefound', () => {
            console.log('[SW] 发现新版本，正在更新...');
        });
        
        return reg;
    } catch (e) {
        console.error('[SW] 注册失败:', e);
        return null;
    }
}

/** 当前通知权限状态 */
export function getNotificationPermission(): PushPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    return (Notification.permission as PushPermission) ?? 'default';
}

/** 是否已支持通知（SW + Notification） */
export function isPushSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(
        'serviceWorker' in navigator &&
        'Notification' in window
    );
}

/** 
 * 请求通知权限
 * 只需要获取通知权限，通知将通过 Service Worker 的 postMessage API 显示
 */
export async function requestPermissionAndSubscribe(): Promise<{
    ok: boolean;
    reason?: string;
}> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return { ok: false, reason: '当前浏览器不支持通知' };
    }

    const perm = getNotificationPermission();
    if (perm === 'denied') {
        return { ok: false, reason: '您已拒绝通知权限' };
    }

    // 确保 SW 已就绪
    const registration = await navigator.serviceWorker.ready;
    if (!registration) {
        return { ok: false, reason: 'Service Worker 未就绪' };
    }

    // 如果是第一次，请求权限
    if (perm === 'default') {
        const newPerm = (await Notification.requestPermission()) as PushPermission;
        if (newPerm !== 'granted') {
            return { ok: false, reason: '未获得通知授权' };
        }
    }

    try {
        // 只需要获取通知权限，不需要 Web Push 订阅
        // 通知将通过 Service Worker 的 postMessage API 显示
        console.log('[Notification] ✅ 通知权限已获取');
        console.log('[Notification] 通知将通过 Service Worker 显示，无需后端推送');
        return { ok: true };
    } catch (e: any) {
        console.error('[Notification] ❌ 初始化失败:', {
            message: e?.message,
            stack: e?.stack,
            error: e,
        });
        return { ok: false, reason: e?.message || '初始化失败' };
    }
}

// 以下函数已不再使用（Web Push 订阅已移除）
// 当前实现完全基于 Service Worker postMessage，不需要 Web Push API
