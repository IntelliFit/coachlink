import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '教练与学员连接｜CoachLink 教链',
  description: '在 CoachLink 教链发现教练、订阅服务，或进入教练端管理学员、点评视频与发布内容。',
};

export default function CoachPage() {
  return (
    <main className="min-h-screen bg-surface px-6 py-14">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-surface-900">
          教练与学员的训练管理平台
        </h1>
        <p className="mt-3 text-surface-600 max-w-2xl">
          你可以在这里发现教练并开始订阅；如果你是教练，也可以进入教练端管理学员与训练内容。
        </p>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/coach/discovery"
            className="rounded-2xl border border-surface-200 bg-surface-50 p-6 hover:border-primary-300 hover:shadow-sm transition-all"
          >
            <div className="text-lg font-black text-surface-900">发现教练</div>
            <div className="mt-2 text-sm text-surface-600">浏览教练列表，查看资质与服务内容。</div>
          </Link>

          <Link
            href="/coach/subscription"
            className="rounded-2xl border border-surface-200 bg-surface-50 p-6 hover:border-primary-300 hover:shadow-sm transition-all"
          >
            <div className="text-lg font-black text-surface-900">我的教练</div>
            <div className="mt-2 text-sm text-surface-600">查看你的订阅教练与服务状态（需要登录）。</div>
          </Link>
        </div>
      </div>
    </main>
  );
}
