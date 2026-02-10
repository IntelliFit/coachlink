import type { Metadata } from 'next';
import Link from 'next/link';
import LoginPageClient from './LoginPageClient';
import LoginPageActionsClient from './LoginPageActionsClient';

export const metadata: Metadata = {
    title: '登录 CoachLink 教链  ｜教练与学员的训练管理平台',
    description: '登录 CoachLink 教链，开始训练计划管理、今日训练一键开练、视频上传点评与进度追踪。',
};

export default function LoginPage() {
    return (
        <main className="min-h-screen flex items-center justify-center bg-surface px-6 py-12">
            {/* 提供可爬内容，避免 Bing 抓到空页面导致缺少 H1 */}
            <h1 className="sr-only">登录 CoachLink 教链</h1>

            {/* 保持原行为：进入 /login 会自动打开登录弹窗 */}
            <LoginPageClient />
        </main>
    );
}
