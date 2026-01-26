/**
 * Service Worker 注册与 Web Push 订阅
 * 兼容 Android 常见浏览器与 iOS Safari 16.4+
 *
 * 注意：iOS 要求权限请求必须由用户手势触发（如点击按钮）。
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

/** 是否已支持推送（SW + Notification + PushManager） */
export function isPushSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    );
}

/** * 请求通知权限。
 * 即使没有 FCM，我们也需要获取权限来通过 Service Worker 弹出本地通知。
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
        // 【关键改动】：不再调用 pushManager.subscribe()，因为那会请求 Google 服务器
        // 相反，我们向后端上报“该用户已开启通知”，并建立你的长连接（WebSocket）
        console.log('[Notification] 权限已获取，通知后端记录设备状态');
        
        const res = await fetch('/api/push/register-local', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status: 'granted',
                userAgent: navigator.userAgent 
            }),
        });

        if (!res.ok) return { ok: false, reason: '上报设备状态失败' };
        
        return { ok: true };
    } catch (e: any) {
        return { ok: false, reason: e?.message || '初始化失败' };
    }
}
function urlBase64ToUint8Array(base64: string): Uint8Array {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const raw = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(raw);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function subscriptionToJson(sub: PushSubscription): Record<string, unknown> {
    const j = sub.toJSON();
    return {
        endpoint: j.endpoint,
        keys: j.keys,
        expirationTime: j.expirationTime ?? null,
    };
}
