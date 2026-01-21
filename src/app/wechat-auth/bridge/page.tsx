'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function WechatAuthBridgePage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const returnTo = searchParams.get('returnTo') || '/';

    // 通知父页面（登录弹窗）微信登录已完成，让其刷新 session/跳转
    try {
      window.parent?.postMessage(
        { type: 'coachlink:wechat-auth-complete', returnTo },
        window.location.origin
      );
    } catch {
      // ignore
    }

    // 如果不是 iframe 场景（用户单独打开了此页），直接跳回
    if (window.top === window.self) {
      window.location.replace(returnTo);
    }
  }, [searchParams]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface p-6">
      <div className="text-center">
        <div className="text-surface-900 font-black text-lg">登录成功</div>
        <div className="mt-2 text-surface-500 text-sm">正在返回…</div>
      </div>
    </main>
  );
}

