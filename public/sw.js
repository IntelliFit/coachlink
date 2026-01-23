/**
 * Service Worker：PWA 离线与系统推送通知
 * 兼容 Android 常见浏览器与 iOS Safari 16.4+
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
 * 解析 push  payload，兼容各端
 * 预期 JSON: { title?, body?, icon?, image?, tag?, url?, data? }
 */
function parsePushPayload(event) {
  let data = { title: 'CoachLink 教链', body: '', icon: DEFAULT_ICON, tag: 'default', url: '/' };
  if (event.data) {
    try {
      const raw = event.data.json();
      if (raw && typeof raw === 'object') {
        if (typeof raw.title === 'string') data.title = raw.title;
        if (typeof raw.body === 'string') data.body = raw.body;
        if (typeof raw.icon === 'string') data.icon = raw.icon;
        if (typeof raw.tag === 'string') data.tag = raw.tag;
        if (typeof raw.url === 'string') data.url = raw.url;
        if (raw.data && typeof raw.data === 'object') data.data = raw.data;
      }
    } catch (_) {
      try {
        const text = event.data.text();
        if (text) data.body = text;
      } catch (_) {}
    }
  }
  return data;
}

/**
 * 显示系统通知。选项兼容 Android / iOS Safari。
 */
function showNotification(registration, payload) {
  const base = {
    body: payload.body,
    icon: payload.icon || DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: payload.tag || 'default',
    data: { url: payload.url || '/', ...(payload.data || {}) },
    requireInteraction: false,
    silent: false,
  };
  // iOS Safari 对部分选项支持有限，保持简洁
  return registration.showNotification(payload.title, base);
}

self.addEventListener('push', (event) => {
  console.log('[SW] 收到 push 事件', event);
  const payload = parsePushPayload(event);
  console.log('[SW] 解析后的 payload:', payload);
  event.waitUntil(
    showNotification(self.registration, payload)
      .then(() => {
        console.log('[SW] 通知已显示');
      })
      .catch((err) => {
        console.error('[SW] 显示通知失败:', err);
      })
  );
});

/**
 * 用户点击通知：优先聚焦已有同源窗口并导航到 url，否则新开窗口。
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  const promise = self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        client.navigate(url);
        return client.focus();
      }
    }
    if (self.clients.openWindow) {
      return self.clients.openWindow(new URL(url, self.location.origin).href);
    }
  });

  event.waitUntil(promise);
});
