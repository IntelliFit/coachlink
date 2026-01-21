'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function WechatLoginBridgePage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('正在登录…');

  const code = useMemo(() => searchParams.get('code') || '', [searchParams]);
  const state = useMemo(() => searchParams.get('state') || '', [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        if (!code || !state) {
          throw new Error('缺少 code/state，请刷新二维码重试');
        }

        const res = await fetch('/api/wechat/login/finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state }),
        });
        const json = await res.json().catch(() => ({}));
        if (!json?.success || !json?.data?.loginToken) {
          throw new Error(json?.message || '登录失败，请重试');
        }

        const returnTo = typeof json.data.returnTo === 'string' ? json.data.returnTo : '/today-training';
        const loginToken = json.data.loginToken as string;

        if (cancelled) return;
        setStatus('success');
        setMessage('登录成功，正在返回…');

        // 通知父页面（登录弹窗）拿到一次性登录 token，父页面再用 NextAuth credentials 完成登录态写入
        try {
          window.parent?.postMessage(
            { type: 'coachlink:wechat-login-token', loginToken, returnTo },
            window.location.origin,
          );
        } catch {
          // ignore
        }

        // 如果不是 iframe 场景（用户单独打开了此页），直接跳回
        if (window.top === window.self) {
          window.location.replace(returnTo);
        }
      } catch (e: any) {
        console.error('[wechat-login-bridge] error:', e);
        if (cancelled) return;
        setStatus('error');
        setMessage(e?.message || '登录失败');
        try {
          window.parent?.postMessage(
            { type: 'coachlink:wechat-login-error', message: e?.message || '登录失败' },
            window.location.origin,
          );
        } catch {
          // ignore
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [code, state]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface p-6">
      <div className="text-center">
        <div className="text-surface-900 font-black text-lg">
          {status === 'error' ? '微信登录失败' : status === 'success' ? '登录成功' : '微信登录'}
        </div>
        <div className="mt-2 text-surface-500 text-sm">{message}</div>
        <div className="mt-2 text-surface-400 text-xs">正在返回…</div>
      </div>
    </main>
  );
}

