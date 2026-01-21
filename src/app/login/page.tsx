import type { Metadata } from 'next';
import Link from 'next/link';
import LoginPageClient from './LoginPageClient';
import LoginPageActionsClient from './LoginPageActionsClient';

export const metadata: Metadata = {
  title: '登录 CoachLink 教链｜教练与学员的训练管理平台',
  description: '登录 CoachLink 教链，开始训练计划管理、今日训练一键开练、视频上传点评与进度追踪。',
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-surface px-6 py-12">
      {/* 提供可爬内容，避免 Bing 抓到空页面导致缺少 H1 */}
      <h1 className="sr-only">登录 CoachLink 教链</h1>

      <div className="max-w-md w-full rounded-3xl border border-surface-200 bg-surface shadow-sm p-8">
        <div className="text-center">
          <div className="text-2xl font-black text-surface-900 tracking-tight">欢迎回来</div>
          <p className="mt-2 text-sm text-surface-600">
            登录后可进入今日训练、管理计划、查看消息与训练数据。
          </p>
        </div>

        <div className="mt-6 text-center text-sm text-surface-500">
          弹窗未自动打开？请{' '}
          <LoginPageActionsClient />
          ，或前往{' '}
          <Link href="/" className="text-primary-600 font-bold hover:text-primary-700 transition-colors">
            首页
          </Link>
          继续浏览。
        </div>

        {/* 保持原行为：进入 /login 会自动打开登录弹窗 */}
        <LoginPageClient />
      </div>
    </main>
  );
}