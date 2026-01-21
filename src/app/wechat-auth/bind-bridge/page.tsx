'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function WechatBindBridgePage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const status = searchParams.get('status') || 'success';
    const message = searchParams.get('message') || '';
    const returnTo = searchParams.get('returnTo') || '/me/profile';

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

    if (window.top === window.self) {
      window.location.replace(returnTo);
    }
  }, [searchParams]);

  const status = searchParams.get('status') || 'success';
  const message = searchParams.get('message') || (status === 'success' ? '绑定成功' : '绑定失败');

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface p-6">
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

