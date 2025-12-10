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
            <section className="relative z-10 text-center max-w-2xl mb-20">
                <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-10">
                    <span className="text-primary">教链</span>
                    <br />
                    教练与学员最稳固的桥梁
                </h1>

                <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 leading-relaxed mb-10">
                    "教链CoachLink" 为教练与学员打造的一体化训练平台。
                    缩短教练到学员之间的距离，让一切都变得更轻松。
                </p>

                {/* CTA 按钮组 */}
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Button className="font-semibold">
                        创建训练计划
                    </Button>

                    <Button className="font-semibold" outlined>
                        浏览教练服务
                    </Button>
                </div>
            </section>


            {/* 服务介绍 Section */}
            <section className="relative z-10 max-w-4xl text-center mt-8 space-y-8">

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mt-6">
                    <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-black/30 backdrop-blur">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">AI 训练计划制定</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                            根据目标、经验、器械自动生成高质量训练计划，教练也可进一步调整优化。
                        </p>
                    </div>

                    <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-black/30 backdrop-blur">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">自动重量与强度计算</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                            自动根据学员进度与目标计算重量、RPE、强度区间，降低教练重复劳动。
                        </p>
                    </div>

                    <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-black/30 backdrop-blur">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">学员订阅与计划管理</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                            学员可订阅教练服务，实时同步训练计划与记录，沟通与管理更高效。
                        </p>
                    </div>
                </div>
            </section>

        </main>
    );
}
