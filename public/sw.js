/**
 * Service Worker：CoachLink 教链 - 消息通知中心
 * 兼容：Android Chrome/Edge, iOS Safari 16.4+
 */

const DEFAULT_ICON = '/icons/icon-192.png';
const DEFAULT_BADGE = '/icons/icon-72.png';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

/**
 * 核心通知显示函数
 */
function displayNotification(payload) {
    console.log('[SW] displayNotification 被调用，载荷:', payload);
    console.log('[SW] 当前 Service Worker 注册状态:', {
        active: !!self.registration.active,
        scope: self.registration.scope,
    });
    
    // 检查通知权限
    if (Notification.permission !== 'granted') {
        const error = new Error(`通知权限未授予，当前权限: ${Notification.permission}`);
        console.error('[SW] ❌', error.message);
        return Promise.reject(error);
    }
    
    const options = {
        body: payload.body || '',
        icon: payload.icon || DEFAULT_ICON,
        badge: DEFAULT_BADGE,
        tag: payload.tag || 'default', // 相同 tag 的通知会覆盖，避免刷屏
        data: { 
            url: payload.url || '/', 
            ...(payload.data || {}) 
        },
        requireInteraction: false, // 自动隐藏通知
        silent: false,
        // Mac 上可能需要这些选项
        vibrate: [200, 100, 200],
    };

    console.log('[SW] 通知选项:', options);
    console.log('[SW] 准备调用 showNotification...');
    
    return self.registration.showNotification(payload.title || '教链提醒', options)
        .then(() => {
            console.log('[SW] ✅ 通知显示成功');
            console.log('[SW] 通知标题:', payload.title);
            console.log('[SW] 通知内容:', payload.body);
            return true;
        })
        .catch((error) => {
            console.error('[SW] ❌ 通知显示失败:', error);
            console.error('[SW] 错误详情:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
            });
            throw error;
        });
}

/**
 * 监听来自前端页面的 Message 指令 (替代 FCM 推送)
 */
self.addEventListener('message', (event) => {
    console.log('[SW] 收到 message 事件:', event.data);
    console.log('[SW] 消息来源:', event.source);
    console.log('[SW] 当前 Service Worker 状态:', self.registration.active ? 'active' : 'inactive');
    
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        console.log('[SW] 收到本地消息指令:', event.data.payload);
        const promise = displayNotification(event.data.payload);
        event.waitUntil(promise);
        
        // 发送确认消息回前端（如果可能）
        if (event.ports && event.ports.length > 0) {
            promise.then(() => {
                event.ports[0].postMessage({ success: true });
            }).catch((error) => {
                event.ports[0].postMessage({ success: false, error: error.message });
            });
        }
    } else if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] 收到 SKIP_WAITING 指令，立即激活');
        self.skipWaiting();
    }
});

/**
 * 保留原有的 Push 监听 (即使无法直连 FCM，逻辑也保持兼容)
 */
self.addEventListener('push', (event) => {
    console.log('[SW] 收到 push 事件:', event);
    let payload = { title: '教链提醒', body: '' };
    try {
        if (event.data) {
            payload = event.data.json();
            console.log('[SW] Push 事件载荷 (JSON):', payload);
        } else {
            console.log('[SW] Push 事件没有数据');
        }
    } catch (e) {
        console.warn('[SW] Push 事件数据解析失败，尝试作为文本:', e);
        payload.body = event.data ? event.data.text() : '';
    }
    console.log('[SW] 准备显示通知:', payload);
    event.waitUntil(displayNotification(payload));
});

/**
 * 通知点击事件：唤起并跳转窗口
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || '/';

    const promiseChain = self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    }).then((clientList) => {
        // 如果已经打开了应用页面，直接聚焦并导航
        for (const client of clientList) {
            if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                client.navigate(url);
                return client.focus();
            }
        }
        // 否则新开窗口
        if (self.clients.openWindow) {
            return self.clients.openWindow(new URL(url, self.location.origin).href);
        }
    });

    event.waitUntil(promiseChain);
});