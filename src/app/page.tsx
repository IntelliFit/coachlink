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
            <section className="relative z-10 text-center max-w-4xl mb-20 pt-20 sm:pt-auto sm:mb-24 mt-4 sm:mt-10">

                <div>
                    <img src="/favicon.jpg" alt="" className="sm:hidden w-[150px] rounded-2xl mx-auto mb-4" />
                </div>

                {/* 主标题：使用最深的 surface-900 */}
                <h1 className="text-5xl sm:text-6xl md:text-8xl font-black leading-[1.1] mb-6 sm:mb-8 tracking-tighter text-surface-900">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600">
                        CoachLink 教链
                    </span>

                </h1>

                {/* 副标题：使用中性的 surface-500 和强调的 surface-900 */}
                <p className="text-sm sm:text-lg md:text-xl text-surface-500 leading-relaxed mb-8 sm:mb-12 max-w-2xl mx-auto font-medium">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600">教链</span> 不仅仅是训练工具，更是您的专属运动管家。
                    <br />
                    我们将专业的 <span className="text-surface-900 font-bold underline decoration-orange-200 underline-offset-4">教练指导</span> 与 <span className="text-surface-900 font-bold underline decoration-orange-200 underline-offset-4">智能化数据分析</span> 完美融合。
                </p>

                {/* Mobile: 不要被 flex-col 默认 stretch 拉满导致“看起来被放大” */}
                <div className="flex flex-row justify-center items-center gap-4 sm:gap-5">
                    <Button
                        className="group font-bold w-auto sm:w-[82vw] max-w-[320px] px-4 sm:px-10 py-3 sm:py-4 bg-orange-500 border-none rounded-2xl shadow-xl shadow-orange-200 dark:shadow-orange-700 hover:bg-orange-600 transition-all active:scale-95 text-white text-sm sm:text-lg"
                        onClick={handleStartTraining}
                    >
                        <span className="flex items-center justify-center gap-2">
                            立即开始训练 <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </span>
                    </Button>

                    {/* 次要按钮：文字使用 surface-700 */}
                    <Button
                        outlined
                        className="font-bold w-auto sm:w-[82vw] max-w-[320px] px-4 sm:px-10 py-3 sm:py-4 rounded-2xl transition-all active:scale-95 text-sm sm:text-lg"
                        onClick={() => router.push('/coach/application')}
                    >
                        入驻成为教练
                    </Button>
                </div>
            </section>

            <br />
            <br />

            {/* 核心亮点网格 (Aero-Productivity 优化版) */}
            <section className="relative z-10 max-w-7xl w-full px-4 mt-20 mb-12 sm:mb-40 transition-all">
                {/* 头部排版：紧凑型字间距与呼吸感控制 */}
                <div className="text-center mb-12 sm:mb-24 px-6">
                    <h2 className="text-3xl sm:text-5xl font-black mb-4 tracking-tighter text-surface-900 leading-tight">
                        重新定义 <span className="text-primary-500">训练体验</span>
                    </h2>
                    <p className="text-surface-500 font-medium text-base sm:text-xl tracking-tight max-w-2xl mx-auto opacity-80">
                        每一个细节，都为了更高效、更科学、更强大的你
                    </p>
                </div>

                {/* Mobile: 跑马灯组件优化 - 强化边缘消失感与物理质感 */}
                <div className="sm:hidden mb-12 relative">
                    {/* 左右渐变边缘：利用 surface 背景色实现呼吸感过渡 */}
                    <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-surface to-transparent z-10 pointer-events-none" />
                    <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-surface to-transparent z-10 pointer-events-none" />

                    <div className="overflow-hidden">
                        <div className="marquee-track flex gap-4 w-max py-2">
                            {featureMarquee.map((feature, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-surface border border-surface-100/50 shadow-sm active:scale-[0.96] transition-transform duration-200"
                                >
                                    {/* 低饱和功能色图标背景：50级底色 + 600级深字 */}
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-inner
                                        ${feature.color.replace('bg-', 'bg-').replace('-500', '-50')} 
                                        ${feature.color.replace('bg-', 'text-').replace('-500', '-600')}`}
                                    >
                                        <feature.icon size={20} strokeWidth={2.5} />
                                    </div>
                                    <span className="text-[15px] font-bold text-surface-900 tracking-tight whitespace-nowrap">
                                        {feature.title}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Desktop/Pad: 网格展示 - 物理反馈与层次深度 */}
                <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                    {features.map((feature, idx) => (
                        <div
                            key={idx}
                            className={`
                                group relative p-8 rounded-[2rem] bg-surface 
                                border border-surface-200/30 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]
                                hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08)] 
                                hover:-translate-y-2 active:scale-[0.98]
                                transition-all duration-500 ease-out
                            `}
                        >
                            {/* 图标区域：物理缩放与色相映射 */}
                            <div className={`
                                w-14 h-14 rounded-2xl flex items-center justify-center mb-8
                                shadow-sm group-hover:shadow-md group-hover:scale-110 
                                transition-all duration-500 ease-out rotate-3 group-hover:rotate-0
                                ${feature.color.replace('bg-', 'bg-').replace('-500', '-50')} 
                                ${feature.color.replace('bg-', 'text-').replace('-500', '-600')}
                            `}>
                                <feature.icon size={28} strokeWidth={2.2} />
                            </div>

                            {/* 标题：数值中心化视觉逻辑 */}
                            <h3 className="text-xl font-black text-surface-900 mb-3 tracking-tighter leading-snug">
                                {feature.title}
                            </h3>

                            {/* 描述：信息约束与低对比度辅助色 */}
                            <p className="text-surface-500 text-[15px] leading-relaxed font-medium line-clamp-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                {feature.desc}
                            </p>

                            {/* 底部微动效装饰线 */}
                            <div className={`
                                absolute bottom-6 left-8 right-8 h-1 rounded-full scale-x-0 group-hover:scale-x-100 
                                transition-transform duration-700 origin-left opacity-20
                                ${feature.color}
                            `} />
                        </div>
                    ))}
                </div>
            </section>

            {/* 自定义滚动动画逻辑 */}
            <style jsx global>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .marquee-track {
                    animation: marquee 25s linear infinite;
                }
                .marquee-track:active {
                    animation-play-state: paused;
                }
            `}</style>

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