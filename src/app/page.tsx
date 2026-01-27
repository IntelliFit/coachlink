'use client';

// 强制动态渲染，禁用静态生成和缓存
export const dynamic = 'force-dynamic';

import { useState } from "react";
import { Button } from "primereact/button";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
    BrainCircuit, Zap, ArrowRight,
    ShieldCheck, TrendingUp, Video, Trophy,
    BookOpen, Layers, Sparkles, Lock, QrCode, Users, Gift
} from 'lucide-react';

export default function Home() {
    const router = useRouter();
    const { data: session } = useSession();
    const [qrFailed, setQrFailed] = useState(false);

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
                        className="group font-bold w-auto flex justify-center sm:w-[82vw] max-w-[320px] px-4 sm:px-10 py-3 sm:py-4 bg-orange-500 border-none rounded-2xl shadow-xl shadow-orange-200 dark:shadow-orange-700 hover:bg-orange-600 transition-all active:scale-95 text-white text-sm sm:text-lg"
                        onClick={handleStartTraining}
                    >
                        <span className="flex items-center justify-center gap-2">
                            立即开始训练 <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </span>
                    </Button>

                    {/* 次要按钮：文字使用 surface-700 */}
                    <Button
                        outlined
                        className="font-bold w-auto flex justify-center sm:w-[82vw] max-w-[320px] px-4 sm:px-10 py-3 sm:py-4 rounded-2xl transition-all active:scale-95 text-sm sm:text-lg"
                        onClick={() => router.push('/coach/application')}
                    >
                        入驻成为教练
                    </Button>
                </div>
            </section>

            {/* 小程序内测群招募 */}
            <section className="relative z-10 max-w-6xl w-full px-4 -mt-6 sm:-mt-10 mb-16 sm:mb-20">
                <div className="relative overflow-hidden rounded-2xl bg-surface-0 border border-surface-100 shadow-sm hover:shadow-md transition-shadow">
                    {/* 装饰性光晕 */}
                    <div className="absolute -top-28 -right-28 w-[420px] h-[420px] bg-primary-500/8 rounded-full blur-[90px]" />
                    <div className="absolute -bottom-28 -left-28 w-[420px] h-[420px] bg-primary-500/6 rounded-full blur-[100px]" />

                    <div className="relative p-6 sm:p-10 md:p-12 grid grid-cols-1 md:grid-cols-[1fr_280px] gap-8 items-center">
                        <div className="text-left">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 text-xs font-black uppercase tracking-widest">
                                <Users className="w-3 h-3" />
                                小程序内测招募
                            </div>

                            <h2 className="mt-5 text-2xl sm:text-4xl font-black tracking-tight text-surface-900 leading-tight">
                                小程序版本正在持续制作中，欢迎加入内测群
                            </h2>

                            <p className="mt-4 text-surface-600 text-sm sm:text-base leading-relaxed font-medium max-w-2xl line-clamp-3">
                                我们会持续迭代功能与体验。欢迎你在内测群提出宝贵建议；对积极反馈的用户，我们将提供专属权益（例如终身会员等）。
                            </p>

                            <div className="mt-6 flex flex-col sm:flex-row flex-wrap gap-x-6 gap-y-3 text-sm">
                                <div className="flex items-center gap-2 text-surface-700 font-bold">
                                    <Zap size={16} className="text-primary-600" />
                                    优先体验新功能
                                </div>
                                <div className="flex items-center gap-2 text-surface-700 font-bold">
                                    <Sparkles size={16} className="text-primary-600" />
                                    参与产品共创与讨论
                                </div>
                                <div className="flex items-center gap-2 text-surface-700 font-bold">
                                    <Gift size={16} className="text-primary-600" />
                                    反馈奖励（终身会员等）
                                </div>
                            </div>

                            <p className="mt-5 text-xs text-surface-500">
                                提示：可长按/扫码识别右侧二维码加入微信群。
                            </p>
                        </div>

                        <div className="flex flex-col items-center justify-center">
                            <div className="w-[220px] h-[220px] rounded-2xl bg-surface-0 shadow-sm border border-surface-100 flex items-center justify-center overflow-hidden">
                                {!qrFailed ? (
                                    <img
                                        src="/images/wechat-beta-group-qr.png"
                                        alt="加入内测群微信二维码"
                                        className="w-full h-full object-cover"
                                        onError={() => setQrFailed(true)}
                                    />
                                ) : (
                                    <div className="p-6 text-center">
                                        <div className="mx-auto w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 mb-3">
                                            <QrCode className="w-6 h-6" />
                                        </div>
                                        <div className="text-surface-900 font-black text-sm">二维码暂未配置</div>
                                        <div className="mt-1 text-xs text-surface-500 leading-relaxed">
                                            请稍后再试，或联系官方获取入群方式
                                        </div>
                                        {process.env.NODE_ENV !== 'production' && (
                                            <div className="mt-2 text-[11px] text-surface-400 font-mono">
                                                public/images/wechat-beta-group-qr.png
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="mt-3 text-sm font-black text-surface-900 tracking-tight">加入内测群</div>
                            <div className="text-xs text-surface-500">获取新功能优先体验与反馈奖励</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 核心亮点网格 (Aero-Productivity 优化版) */}
            <section className="relative z-10 max-w-7xl w-full px-4 mt-20 mb-12 sm:mb-40 transition-all">
                {/* 头部排版：紧凑型字间距与呼吸感控制 */}
                <div className="text-center mb-12 sm:mb-20 px-6">
                    <h2 className="text-3xl sm:text-5xl font-black mb-4 tracking-tight text-surface-900 leading-tight">
                        重新定义 <span className="text-primary-600">训练体验</span>
                    </h2>
                    <p className="text-surface-500 font-medium text-base sm:text-lg tracking-tight max-w-2xl mx-auto">
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

            {/* 服务商品分类入口（为合规/审核提供清晰入口） */}
            <section className="relative z-10 max-w-7xl w-full px-4 mb-12 sm:mb-20">
                <div className="text-center mb-10 sm:mb-14 px-6">
                    <h2 className="text-3xl sm:text-5xl font-black mb-4 tracking-tight text-surface-900 leading-tight">
                        服务商品分类
                    </h2>
                    <p className="text-surface-500 font-medium text-base sm:text-lg tracking-tight max-w-2xl mx-auto">
                        选择教练订阅/训练计划等服务商品，开启你的训练之旅
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        {
                            title: '服务商品',
                            desc: '聚合展示教练订阅/计划服务商品，支持按时长选择。',
                            icon: Layers,
                            href: '/market',
                            color: 'bg-primary-50 text-primary-600',
                        },
                        {
                            title: '发现教练',
                            desc: '按专长与口碑发现合适的教练，进入主页查看方案。',
                            icon: Users,
                            href: '/coach/discovery',
                            color: 'bg-amber-50 text-amber-600',
                        },
                        {
                            title: '技术文章',
                            desc: '训练科技与产品实践，帮助你理解更科学的训练方式。',
                            icon: BookOpen,
                            href: '/articles',
                            color: 'bg-indigo-50 text-indigo-600',
                        },
                        {
                            title: '入驻流程',
                            desc: '提交资料、审核通过后即可上架服务并开始授课。',
                            icon: ShieldCheck,
                            href: '/coach/application',
                            color: 'bg-green-50 text-green-600',
                        },
                    ].map((item) => (
                        <button
                            key={item.href}
                            onClick={() => router.push(item.href)}
                            className="text-left group p-6 rounded-[2rem] bg-surface border border-surface-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all active:scale-[0.98]"
                        >
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.color} mb-5 border border-surface-100`}>
                                <item.icon size={22} />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-lg font-black text-surface-900 tracking-tight">{item.title}</h3>
                                <ArrowRight size={18} className="text-surface-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                            </div>
                            <p className="mt-2 text-sm text-surface-500 font-medium leading-relaxed line-clamp-2">
                                {item.desc}
                            </p>
                        </button>
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