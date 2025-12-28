'use client';

// 强制动态渲染，禁用静态生成和缓存
export const dynamic = 'force-dynamic';

import { Button } from "primereact/button";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { BrainCircuit, Activity, Zap, ArrowRight } from 'lucide-react';

export default function Home() {
    const router = useRouter();
    const { data: session } = useSession();

    const handleStartTraining = () => {
        if (session?.user) {
            router.push('/today-training');
        } else {
            router.push('/login');
        }
    };

    return (
        <main className="relative flex flex-col items-center justify-center min-h-screen px-6 py-10 overflow-hidden">

            {/* 背景光晕 - 保持不变 */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                <div className="absolute w-[650px] h-[650px] bg-[#F49227]/25 rounded-full blur-[180px]" />
                <div className="absolute w-[420px] h-[420px] bg-[#F49227]/15 rounded-full blur-[220px] translate-x-48 -translate-y-32" />
                <div className="absolute w-[360px] h-[360px] bg-[#F49227]/10 rounded-full blur-[210px] -translate-x-48 translate-y-40" />
            </div>

            {/* Hero 主体 */}
            <section className="relative z-10 text-center max-w-4xl mb-24 mt-10">
                {/* 顶部小标：使用 surface-600 */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 border border-orange-100 text-orange-600 text-sm font-bold mb-10 shadow-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                    </span>
                    连接运动梦想 · 成就专业价值
                </div>

                {/* 主标题：使用最深的 surface-900 */}
                <h1 className="text-6xl md:text-8xl font-black leading-[1.1] mb-8 tracking-tighter text-surface-900">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600">
                        CoachLink 教链
                    </span>
                    <br />
                    <span className="text-4xl md:text-6xl text-surface-800 mt-6 block font-bold tracking-tight">
                        教练与学员的智能连接平台
                    </span>
                </h1>

                {/* 副标题：使用中性的 surface-500 和强调的 surface-900 */}
                <p className="text-lg md:text-xl text-surface-500 leading-relaxed mb-12 max-w-2xl mx-auto font-medium">
                    不仅仅是训练工具，更是您的专属运动管家。
                    <br />
                    我们将专业的 <span className="text-surface-900 font-bold underline decoration-orange-200 underline-offset-4">教练指导</span> 与 <span className="text-surface-900 font-bold underline decoration-orange-200 underline-offset-4">智能化数据分析</span> 完美融合。
                </p>

                <div className="flex flex-col sm:flex-row justify-center gap-5">
                    <Button 
                        className="group font-bold px-10 py-4 bg-orange-500 border-none rounded-2xl shadow-xl shadow-orange-200 dark:shadow-orange-700 hover:bg-orange-600 transition-all active:scale-95 text-white"
                        onClick={handleStartTraining}
                    >
                        <span className="flex items-center gap-2 text-lg">
                            立即开始训练 <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform"/>
                        </span>
                    </Button>

                    {/* 次要按钮：文字使用 surface-700 */}
                    <Button 
                        outlined 
                        className="font-bold px-10 py-4 rounded-2xl transition-all active:scale-95 text-lg"
                        onClick={() => router.push('/coach/application')}
                    >
                        入驻成为教练
                    </Button>
                </div>
            </section>

            {/* 核心价值网格 */}
            <section className="relative z-10 max-w-6xl w-full px-4">
                <div className="text-center mb-20">
                    <h2 className="text-4xl font-black mb-4 tracking-tight text-surface-900">重新定义专业训练体验</h2>
                    <p className="text-surface-500 font-medium text-lg">从计划制定到执行反馈，全流程智能化支持</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Feature 卡片 */}
                    {[
                        { title: '专业级训练方案构建', desc: '深度结合运动科学与数据模型。让教练的专业经验与智能算法完美融合，输出定制方案。', icon: BrainCircuit, color: 'bg-orange-500' },
                        { title: '科学负荷计算', desc: '系统自动计算最佳负荷、RPE与强度区间，让每一次进步都有据可依，用数据量化成长。', icon: Activity, color: 'bg-blue-500' },
                        { title: '全流程闭环管理', desc: '学员订阅、计划推送、打卡反馈、视频审阅，无缝衔接。提升沟通效率，让专业无处不在。', icon: Zap, color: 'bg-surface-900' }
                    ].map((feature, idx) => (
                        <div key={idx} className="group p-10 rounded-[2.5rem] border border-white/60 bg-white/80 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.04)] transition-all duration-500 hover:-translate-y-2 hover:border-orange-200">
                            <div className={`w-14 h-14 ${feature.color} text-white rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-surface-100 group-hover:rotate-6 transition-transform`}>
                                <feature.icon size={28} />
                            </div>
                            {/* 卡片标题：surface-900 */}
                            <h3 className="text-2xl font-black text-surface-900 mb-4 tracking-tight">
                                {feature.title}
                            </h3>
                            {/* 卡片正文：surface-500 */}
                            <p className="text-surface-500 font-medium leading-relaxed">
                                {feature.desc}
                            </p>
                        </div>
                    ))}
                </div>
                <div className="mb-20"></div>
            </section>
        </main>
    );
}