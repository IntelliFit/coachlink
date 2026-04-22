'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function WechatBindPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;

    // 检查登录状态
    if (status === 'unauthenticated' || !session?.user?.id) {
      setError('请先登录');
      setTimeout(() => {
        router.push('/login?returnTo=' + encodeURIComponent('/wechat-auth/bind?' + searchParams.toString()));
      }, 2000);
      return;
    }

    // 获取返回地址
    const returnTo = searchParams.get('returnTo') || '/me/profile';

    // 获取微信授权 URL
    const init = async () => {
      try {
        const res = await fetch('/api/wechat/bind/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ returnTo }),
        });

        const json = await res.json().catch(() => ({}));
        if (!json?.success || !json?.data?.appid || !json?.data?.redirectUri || !json?.data?.state) {
          throw new Error(json?.message || '未获取到微信授权配置');
        }

        // 构建微信授权 URL
        const { appid, redirectUri, state } = json.data;
        const wechatAuthUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${appid}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`;

        // 跳转到微信授权页面
        window.location.href = wechatAuthUrl;
      } catch (e: any) {
        console.error('[wechat-bind] init error:', e);
        setError(e?.message || '微信绑定初始化失败');
        setLoading(false);
      }
    };

    init();
  }, [status, session, searchParams, router]);

  if (loading && !error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-surface-900 font-black text-lg">正在跳转到微信授权页面…</div>
          <div className="mt-2 text-surface-500 text-sm">请稍候</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-surface-900 font-black text-lg">微信绑定失败</div>
          <div className="mt-2 text-surface-500 text-sm">{error}</div>
          <div className="mt-2 text-surface-400 text-xs">正在返回…</div>
        </div>
      </main>
    );
  }

  return null;
}
