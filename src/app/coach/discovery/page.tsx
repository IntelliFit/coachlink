'use client';

import React from 'react';
import dynamic from 'next/dynamic';

/**
 * 轻量级 shell：仅包含 minimal 依赖，确保首次编译极快（解决低配置机器卡死）。
 * 主内容通过动态导入加载，用户会先看到「加载中...」，再展示完整发现页。
 */
const DiscoveryContent = dynamic(() => import('./DiscoveryContent'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-6">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-surface-300 border-t-surface-900 rounded-full animate-spin mx-auto mb-4" />
        <div className="text-sm font-black text-surface-900">正在加载发现页…</div>
        <div className="mt-2 text-xs text-surface-500">首次加载可能需要 30 秒到 1 分钟，请稍候</div>
        </div>
    </div>
  ),
});

export default function DiscoveryPage() {
  return <DiscoveryContent />;
}
