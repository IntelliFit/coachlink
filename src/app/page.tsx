'use client';

// 强制动态渲染，禁用静态生成和缓存
export const dynamic = 'force-dynamic';

import { Button } from "primereact/button";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
    BrainCircuit, Activity, Zap, ArrowRight,
    ShieldCheck, TrendingUp, Video, Trophy,
    BookOpen, Layers, Sparkles, Lock
} from 'lucide-react';
import { Tag } from "primereact/tag";

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

    // 8大核心亮点数据
    const features = [
        {
            title: '靠谱教练，放心选择',
            desc: '资质认证，评价透明。平台担保交易，拒绝跑路风险。',
            icon: ShieldCheck,
            color: 'bg-green-500'
        },
        {
            title: '今日训练，即开即练',
            desc: '告别翻聊天记录。打开即练，视频一键上传，打卡分享。',
            icon: Zap,
            color: 'bg-yellow-500'
        },
        {
            title: '智能负荷，自动计算',
            desc: '根据1RM数据自动计算每组精准重量，随你变强自动调整。',
            icon: BrainCircuit,
            color: 'bg-blue-500'
        },
        {
            title: '成长档案，进步可见',
            desc: '自动捕捉每一次 PR（个人纪录），生成专属进步时间轴。',
            icon: TrendingUp,
            color: 'bg-purple-500'
        },
        {
            title: '灵活计划，丰俭由人',
            desc: '支持教练定制，也支持自建计划或 AI 智能导入。',
            icon: Layers,
            color: 'bg-cyan-500'
        },
        {
            title: '视频沟通，秒懂背景',
            desc: '视频自动附带“组数/重量”标签，拒绝无效沟通。',
            icon: Video,
            color: 'bg-red-500'
        },
        {
            title: '竞技排行，赢取奖金',
            desc: '多维度排行榜，挑战全国高手，赢取荣誉与奖金。',
            icon: Trophy,
            color: 'bg-orange-500'
        },
        {
            title: '权威知识，拒绝伪科',
            desc: '教练专属内容 + 平台严选资料，构建科学训练体系。',
            icon: BookOpen,
            color: 'bg-indigo-500'
        }
    ];

    // 移动端：核心卖点只展示一行，并自动滚动（不手动滑动）
    const featureMarquee = [...features, ...features];

    return (
        <main className="relative flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 py-6 sm:py-10 overflow-hidden">

            {/* 背景光晕 */}
            <div className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden z-0">
                {/* 增加一个内部容器来限制光晕的中心点 */}
                <div className="relative w-full h-full flex items-center justify-center">
                    <div className="absolute w-[650px] h-[650px] bg-[#F49227]/25 rounded-full blur-[180px]" />
                    <div className="absolute w-[420px] h-[420px] bg-[#F49227]/15 rounded-full blur-[220px] translate-x-48 -translate-y-32" />
                    <div className="absolute w-[360px] h-[360px] bg-[#F49227]/10 rounded-full blur-[210px] -translate-x-48 translate-y-40" />
                </div>
            </div>

            {/* Hero 主体 */}
            <section className="relative z-10 text-center max-w-4xl mb-12 sm:mb-24 mt-4 sm:mt-10">
                {/* 顶部小标：使用 surface-600 */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 border border-orange-100 text-orange-600 text-sm font-bold mb-6 sm:mb-10 shadow-sm">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                    </span>
                    连接运动梦想 · 成就专业价值
                </div>

                {/* 主标题：使用最深的 surface-900 */}
                <h1 className="text-5xl sm:text-6xl md:text-8xl font-black leading-[1.1] mb-6 sm:mb-8 tracking-tighter text-surface-900">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600">
                        CoachLink 教链
                    </span>
                    <br />
                    <span className="text-3xl sm:text-4xl md:text-6xl text-surface-800 mt-4 sm:mt-6 block font-bold tracking-tight">
                        教练与学员的智能连接平台
                    </span>
                </h1>

                {/* 副标题：使用中性的 surface-500 和强调的 surface-900 */}
                <p className="text-base sm:text-lg md:text-xl text-surface-500 leading-relaxed mb-8 sm:mb-12 max-w-2xl mx-auto font-medium">
                    不仅仅是训练工具，更是您的专属运动管家。
                    <br />
                    我们将专业的 <span className="text-surface-900 font-bold underline decoration-orange-200 underline-offset-4">教练指导</span> 与 <span className="text-surface-900 font-bold underline decoration-orange-200 underline-offset-4">智能化数据分析</span> 完美融合。
                </p>

                {/* Mobile: 核心卖点一行（自动滚动）放在 CTA 上方 */}
                <div className="sm:hidden mb-6">
                    <div className="overflow-hidden -mx-4 px-4">
                        <div className="marquee-track flex gap-3 w-max">
                            {featureMarquee.map((feature, idx) => (
                                <div
                                    key={idx}
                                    aria-hidden={idx >= features.length}
                                    className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface border border-surface-100 shadow-sm"
                                >
                                    <div className={`w-9 h-9 ${feature.color} text-surface rounded-xl flex items-center justify-center shadow-md shadow-surface-100`}>
                                        <feature.icon size={18} strokeWidth={2.5} />
                                    </div>
                                    <div className="text-sm font-black text-surface-900 tracking-tight whitespace-nowrap">
                                        {feature.title}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Mobile: 不要被 flex-col 默认 stretch 拉满导致“看起来被放大” */}
                <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-5">
                    <Button
                        className="group font-bold w-[82vw] max-w-[320px] sm:w-auto px-7 sm:px-10 py-3 sm:py-4 bg-orange-500 border-none rounded-2xl shadow-xl shadow-orange-200 dark:shadow-orange-700 hover:bg-orange-600 transition-all active:scale-95 text-white text-base sm:text-lg"
                        onClick={handleStartTraining}
                    >
                        <span className="flex items-center justify-center gap-2">
                            立即开始训练 <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </span>
                    </Button>

                    {/* 次要按钮：文字使用 surface-700 */}
                    <Button
                        outlined
                        className="font-bold w-[82vw] max-w-[320px] sm:w-auto px-7 sm:px-10 py-3 sm:py-4 rounded-2xl transition-all active:scale-95 text-base sm:text-lg"
                        onClick={() => router.push('/coach/application')}
                    >
                        入驻成为教练
                    </Button>
                </div>
            </section>

            {/* 核心亮点网格 */}
            <section className="relative z-10 max-w-7xl w-full px-4 mb-16 sm:mb-32">
                <div className="text-center mb-8 sm:mb-16">
                    <h2 className="text-3xl sm:text-4xl font-black mb-3 sm:mb-4 tracking-tight text-surface-900">
                        重新定义你的训练体验
                    </h2>
                    <p className="text-surface-500 font-medium text-base sm:text-lg">
                        每一个细节，都为了更高效、更科学、更强大的你
                    </p>
                </div>

                {/* Mobile 端卖点条已放到 CTA 上方，这里不重复展示 */}

                {/* Desktop/Pad: 网格展示 */}
                <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {features.map((feature, idx) => (
                        <div
                            key={idx}
                            className="group p-6 lg:p-8 rounded-[2rem] bg-surface border border-surface-100 shadow-sm hover:shadow-xl hover:shadow-surface-200/50 transition-all duration-300 hover:-translate-y-1"
                        >
                            <div className={`w-12 h-12 ${feature.color} text-surface rounded-xl flex items-center justify-center mb-6 shadow-md shadow-surface-100 group-hover:scale-110 transition-transform duration-300`}>
                                <feature.icon size={24} strokeWidth={2.5} />
                            </div>
                            <h3 className="text-xl font-bold text-surface-900 mb-3 tracking-tight leading-snug line-clamp-2">
                                {feature.title}
                            </h3>
                            <p className="text-surface-500 text-sm leading-relaxed font-medium line-clamp-2">
                                {feature.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* 未来工具箱预告 */}
            {/* 未来工具箱预告 - 仿照 Ranking 样式的深度改造 */}
            <section className="relative z-10 max-w-6xl w-full px-4 mb-12 sm:mb-20">
                <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 shadow-2xl group transition-all duration-500">

                    {/* 装饰性背景 - 采用 Ranking 风格的圆环光晕 */}
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[100px] group-hover:bg-orange-500/20 transition-colors duration-700" />
                    <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-blue-500/10 rounded-full blur-[80px]" />

                    <div className="relative z-10 p-8 sm:p-10 md:p-20 flex flex-col items-center text-center">

                        {/* 顶部标签 - 仿照 Ranking 样式 */}
                        <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-orange-300 text-sm font-bold mb-6 animate-pulse">
                            <Sparkles className="w-4 h-4 mr-2" />
                            COMING SOON
                        </div>

                        {/* 标题 - 仿照 Ranking 的大字重与渐变色 */}
                        <h2 className="text-4xl sm:text-5xl md:text-7xl font-black text-white mb-4 sm:mb-6 tracking-tight uppercase">
                            更多黑科技工具 <span className="text-orange-500">即将上线</span>
                        </h2>

                        {/* 副标题 - 保持原句 */}
                        <p className="text-base sm:text-xl md:text-2xl text-slate-300 max-w-2xl leading-relaxed mb-6 sm:mb-12 line-clamp-3">
                            饮食计算器、AI 动作矫正、热量扫描... <br />
                            我们要做的，不止于计划。
                        </p>

                        {/* 标签云：移动端收敛为 3 个；桌面端保留 5 个 */}
                        <div className="flex flex-wrap justify-center gap-3 mb-6 sm:mb-12">
                            {['饮食计算', 'AI 动作矫正', '热量扫描', '体态分析', '极限估算']
                                .slice(0, 3)
                                .map((item, i) => (
                                    <span
                                        key={i}
                                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs sm:text-sm font-medium backdrop-blur-sm"
                                    >
                                        {item}
                                    </span>
                                ))}
                            <div className="hidden sm:flex flex-wrap justify-center gap-4">
                                {['体态分析', '极限估算'].map((item, i) => (
                                    <span key={`more-${i}`} className="px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm font-medium backdrop-blur-sm">
                                    {item}
                                </span>
                            ))}
                            </div>
                        </div>

                        {/* 权益引导区 - 强化为 Ranking 样式的行动卡片 */}
                        <div className="relative w-full max-w-md p-6 sm:p-8 rounded-[2rem] bg-white/[0.03] border border-white/10 backdrop-blur-sm">
                            <div className="flex flex-col items-center gap-3">
                                <div className="flex items-center gap-2 text-orange-400 font-bold text-lg">
                                    <Lock size={20} />
                                    <span>早鸟福利 (Early Bird)</span>
                                </div>

                                {/* 权益描述文字 - 保持原句 */}
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    首批注册用户将获得 <span className="text-white font-bold">永久优先使用权</span>
                                    <br />后续开放功能可能需付费订阅
                                </p>

                                <Button
                                    label="立即注册锁定权益"
                                    className="mt-4 w-full bg-orange-500 hover:bg-orange-600 border-none text-white font-bold py-4 rounded-xl shadow-xl shadow-orange-500/20 active:scale-95 transition-all"
                                    onClick={() => router.push('/register')}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Mobile 自动滚动（卖点条） */}
            <style jsx global>{`
                @keyframes coachlink-marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .marquee-track {
                    animation: coachlink-marquee 18s linear infinite;
                }
                @media (prefers-reduced-motion: reduce) {
                    .marquee-track {
                        animation: none;
                    }
                }
            `}</style>
        </main>
    );
}