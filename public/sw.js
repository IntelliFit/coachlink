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
    };

    return self.registration.showNotification(payload.title || '教链提醒', options);
}

/**
 * 监听来自前端页面的 Message 指令 (替代 FCM 推送)
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        console.log('[SW] 收到本地消息指令:', event.data.payload);
        event.waitUntil(displayNotification(event.data.payload));
    }
});

/**
 * 保留原有的 Push 监听 (即使无法直连 FCM，逻辑也保持兼容)
 */
self.addEventListener('push', (event) => {
    let payload = { title: '教链提醒', body: '' };
    try {
        payload = event.data ? event.data.json() : payload;
    } catch (e) {
        payload.body = event.data ? event.data.text() : '';
    }
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