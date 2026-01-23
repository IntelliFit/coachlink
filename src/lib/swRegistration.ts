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

/** 请求通知权限并订阅 Push，然后上报服务端。须在用户手势中调用（如点击）。 */
export async function requestPermissionAndSubscribe(): Promise<{
    ok: boolean;
    reason?: string;
}> {
    if (!isPushSupported()) {
        return { ok: false, reason: '当前环境不支持推送' };
    }

    const perm = getNotificationPermission();
    if (perm === 'denied') {
        return { ok: false, reason: '您已拒绝通知权限' };
    }

    let reg = navigator.serviceWorker.ready;
    const existing = navigator.serviceWorker.controller;
    if (!existing) {
        const r = await registerSw();
        if (!r) return { ok: false, reason: 'Service Worker 注册失败' };
        reg = Promise.resolve(r);
    }
    const registration = await reg;

    if (perm === 'default') {
        const newPerm = (await Notification.requestPermission()) as PushPermission;
        if (newPerm !== 'granted') {
            return { ok: false, reason: newPerm === 'denied' ? '您已拒绝通知权限' : '未授予权限' };
        }
    }

    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid || !vapid.trim()) {
        return { ok: false, reason: '未配置 VAPID 公钥' };
    }

    try {
        console.log('[Push] 开始订阅，VAPID 公钥长度:', vapid.length);
        const sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
        });
        console.log('[Push] 订阅成功，endpoint:', sub.endpoint);
        const payload = subscriptionToJson(sub);
        console.log('[Push] 上报订阅到服务端...');
        const res = await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: payload }),
            credentials: 'same-origin',
        });
        const data = (await res.json()) as { success?: boolean; message?: string };
        console.log('[Push] 服务端响应:', data);
        if (!res.ok || !data.success) {
            return { ok: false, reason: data.message || '上报订阅失败' };
        }
        console.log('[Push] 订阅完成！');
        return { ok: true };
    } catch (e: any) {
        console.error('[Push] 订阅失败:', e);
        return { ok: false, reason: e?.message || '订阅失败' };
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
