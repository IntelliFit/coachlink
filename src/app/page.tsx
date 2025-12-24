'use client';

// 强制动态渲染，禁用静态生成和缓存
export const dynamic = 'force-dynamic';

import { Button } from "primereact/button";

export default function Home() {
    return (
        <main className="relative flex flex-col items-center justify-center min-h-screen px-6 py-20 overflow-hidden">

            {/* 背景光晕 */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                <div className="absolute w-[650px] h-[650px] bg-[#F49227]/25 rounded-full blur-[180px]" />
                <div className="absolute w-[420px] h-[420px] bg-[#F49227]/15 rounded-full blur-[220px] translate-x-48 -translate-y-32" />
                <div className="absolute w-[360px] h-[360px] bg-[#F49227]/10 rounded-full blur-[210px] -translate-x-48 translate-y-40" />
            </div>

            {/* Hero 主体 */}
            <section className="relative z-10 text-center max-w-4xl mb-24 mt-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-sm font-medium mb-8">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                    </span>
                    连接运动梦想，成就专业价值
                </div>

                <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-8 tracking-tight">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-500">
                        CoachLink 教链
                    </span>
                    <br />
                    <span className="text-4xl md:text-6xl text-gray-900 dark:text-white mt-4 block">
                        教练与学员的智能连接平台
                    </span>
                </h1>

                <p className="text-xl text-gray-600 dark:text-gray-300 leading-relaxed mb-10 max-w-2xl mx-auto">
                    不仅仅是训练工具，更是您的专属运动管家。
                    <br />
                    我们将专业的教练指导与智能化的数据分析完美融合，
                    让每一次训练都科学高效。
                </p>

                {/* CTA 按钮组 */}
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Button size="large" className="font-bold px-8 shadow-lg shadow-orange-500/20">
                        立即开始训练
                    </Button>

                    <Button size="large" outlined className="font-bold px-8">
                        入驻成为教练
                    </Button>
                </div>
            </section>

            {/* 核心价值网格 */}
            <section className="relative z-10 max-w-6xl w-full px-4">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold mb-4">重新定义专业训练体验</h2>
                    <p className="text-gray-500">从计划制定到执行反馈，全流程智能化支持</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Feature 1 */}
                    <div className="group p-8 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl shadow-gray-200/50 dark:shadow-none transition-all hover:-translate-y-1 hover:shadow-2xl hover:border-orange-200">
                        <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-6 text-2xl group-hover:scale-110 transition-transform">
                            🧠
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                            专业级训练方案构建
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                            深度结合运动科学与数据模型，辅助构建高精度训练框架。让教练的专业经验与智能算法完美融合，输出最适合学员的定制方案。
                        </p>
                    </div>

                    {/* Feature 2 */}
                    <div className="group p-8 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl shadow-gray-200/50 dark:shadow-none transition-all hover:-translate-y-1 hover:shadow-2xl hover:border-orange-200">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6 text-2xl group-hover:scale-110 transition-transform">
                            📊
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                            科学负荷计算
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                            告别凭感觉训练。系统自动计算最佳负荷重量、RPE与强度区间，让每一次进步都有据可依，降低受伤风险。
                        </p>
                    </div>

                    {/* Feature 3 */}
                    <div className="group p-8 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl shadow-gray-200/50 dark:shadow-none transition-all hover:-translate-y-1 hover:shadow-2xl hover:border-orange-200">
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-6 text-2xl group-hover:scale-110 transition-transform">
                            🔗
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                            全流程闭环管理
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                            学员订阅、计划推送、打卡反馈、视频审阅，所有环节无缝衔接。极大提升沟通效率，让指导无处不在。
                        </p>
                    </div>
                </div>
            </section>

             {/* 底部协议链接 */}
             <footer className="relative z-10 mt-20 pb-8 text-center text-sm text-gray-400">
                <div className="flex justify-center gap-6 mb-4">
                    <a href="/docs/agreement" className="hover:text-primary transition-colors">用户协议</a>
                    <span className="text-gray-300">|</span>
                    <a href="/docs/disclaimer" className="hover:text-primary transition-colors">免责声明</a>
                </div>
                <p>© 2025 CoachLink. All rights reserved.</p>
            </footer>

        </main>
    );
}
