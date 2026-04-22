'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function WechatBindBridgePage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const status = searchParams.get('status') || 'success';
    const message = searchParams.get('message') || '';
    const returnTo = searchParams.get('returnTo') || '/me/profile';

    // 如果是 iframe，向父窗口发送消息
    try {
      window.parent?.postMessage(
        {
          type: status === 'success' ? 'coachlink:wechat-bind-complete' : 'coachlink:wechat-bind-error',
          message,
          returnTo,
        },
        window.location.origin,
      );
    } catch {
      // ignore
    }

    // 如果不是 iframe，延迟跳转以显示提示信息，并添加绑定状态参数
    if (window.top === window.self) {
      const timer = setTimeout(() => {
        try {
          // 尝试解析 returnTo 为 URL
          let returnUrl: URL;
          if (returnTo.startsWith('http://') || returnTo.startsWith('https://')) {
            returnUrl = new URL(returnTo);
          } else {
            returnUrl = new URL(returnTo, window.location.origin);
          }
          
          returnUrl.searchParams.set('wechatBind', status);
          if (message) {
            returnUrl.searchParams.set('message', encodeURIComponent(message));
          }
          window.location.replace(returnUrl.toString());
        } catch (e) {
          // 如果 URL 解析失败，使用简单方式拼接
          const separator = returnTo.includes('?') ? '&' : '?';
          const encodedMessage = message ? `&message=${encodeURIComponent(message)}` : '';
          window.location.replace(`${returnTo}${separator}wechatBind=${status}${encodedMessage}`);
        }
      }, 2000); // 2 秒后跳转

      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const status = searchParams.get('status') || 'success';
  const message = searchParams.get('message') || (status === 'success' ? '绑定成功' : '绑定失败');

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-surface-900 font-black text-lg">
          {status === 'success' ? '微信绑定成功' : '微信绑定失败'}
        </div>
        <div className="mt-2 text-surface-500 text-sm">{message}</div>
        <div className="mt-2 text-surface-400 text-xs">正在返回…</div>
      </div>
    </main>
  );
}

