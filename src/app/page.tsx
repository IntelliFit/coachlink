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

    return (
        <main className="relative flex flex-col items-center justify-center min-h-screen px-6 py-10 overflow-hidden bg-slate-50/50">

            {/* 背景光晕 */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                <div className="absolute w-[800px] h-[800px] bg-orange-200/20 rounded-full blur-[120px] -translate-y-1/2" />
                <div className="absolute w-[600px] h-[600px] bg-blue-200/20 rounded-full blur-[100px] translate-y-1/3 translate-x-1/3" />
            </div>

            {/* Hero 主体 */}
            <section className="relative z-10 text-center max-w-5xl mb-24 mt-16">
                {/* 顶部标签 */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 border border-orange-100 text-orange-600 text-sm font-bold mb-10 shadow-sm animate-fade-in-up">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                    </span>
                    连接运动梦想 · 成就专业价值
                </div>

                {/* 主标题 */}
                <h1 className="text-6xl md:text-8xl font-black leading-[1.1] mb-8 tracking-tighter text-surface-900">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600">
                        CoachLink 教链
                    </span>
                    <br />
                    <span className="text-4xl md:text-6xl text-surface-800 mt-6 block font-bold tracking-tight">
                        你的智能运动管家
                    </span>
                </h1>

                {/* 副标题 */}
                <p className="text-lg md:text-xl text-surface-500 leading-relaxed mb-12 max-w-2xl mx-auto font-medium">
                    不仅仅是训练工具，更是连接专业与热爱的桥梁。
                    <br />
                    <span className="text-surface-900 font-bold decoration-orange-300 underline underline-offset-4">科学训练</span>
                    、
                    <span className="text-surface-900 font-bold decoration-orange-300 underline underline-offset-4">高效沟通</span>
                    、
                    <span className="text-surface-900 font-bold decoration-orange-300 underline underline-offset-4">可视成长</span>
                    。
                </p>

                <div className="flex flex-col sm:flex-row justify-center gap-5">
                    <Button 
                        className="group font-bold px-10 py-4 bg-orange-500 border-none rounded-2xl shadow-xl shadow-orange-200/50 hover:bg-orange-600 transition-all active:scale-95 text-white"
                        onClick={handleStartTraining}
                    >
                        <span className="flex items-center gap-2 text-lg">
                            立即开始训练 <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform"/>
                        </span>
                    </Button>

                    <Button 
                        outlined 
                        className="font-bold px-10 py-4 rounded-2xl transition-all active:scale-95 text-lg border-surface-200 hover:bg-surface-50 text-surface-700"
                        onClick={() => router.push('/coach/application')}
                    >
                        入驻成为教练
                    </Button>
                </div>
            </section>

            {/* 核心亮点网格 */}
            <section className="relative z-10 max-w-7xl w-full px-4 mb-32">
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-black mb-4 tracking-tight text-surface-900">
                        重新定义你的训练体验
                    </h2>
                    <p className="text-surface-500 font-medium text-lg">
                        每一个细节，都为了更高效、更科学、更强大的你
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {features.map((feature, idx) => (
                        <div key={idx} className="group p-8 rounded-[2rem] bg-white border border-surface-100 shadow-sm hover:shadow-xl hover:shadow-surface-200/50 transition-all duration-300 hover:-translate-y-1">
                            <div className={`w-12 h-12 ${feature.color} text-white rounded-xl flex items-center justify-center mb-6 shadow-md shadow-surface-100 group-hover:scale-110 transition-transform duration-300`}>
                                <feature.icon size={24} strokeWidth={2.5} />
                            </div>
                            <h3 className="text-xl font-bold text-surface-900 mb-3 tracking-tight">
                                {feature.title}
                            </h3>
                            <p className="text-surface-500 text-sm leading-relaxed font-medium">
                                {feature.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* 未来工具箱预告 */}
            <section className="relative z-10 max-w-5xl w-full px-4 mb-20">
                <div className="relative overflow-hidden rounded-[2.5rem] bg-surface-900 text-white p-10 md:p-20 text-center shadow-2xl shadow-surface-900/20">
                    
                    {/* 背景装饰 */}
                    <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500 rounded-full blur-[150px]" />
                        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500 rounded-full blur-[150px]" />
                    </div>

                    <div className="relative z-10 flex flex-col items-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-orange-300 text-xs font-bold mb-6 backdrop-blur-md">
                            <Sparkles size={14} />
                            COMING SOON
                        </div>
                        
                        <h2 className="text-3xl md:text-5xl font-black mb-6 tracking-tight">
                            更多黑科技工具，即将上线
                        </h2>
                        
                        <p className="text-surface-400 text-lg md:text-xl max-w-2xl mb-10 leading-relaxed">
                            饮食计算器、AI 动作矫正、热量扫描... <br/>
                            我们要做的，不止于计划。
                        </p>

                        <div className="flex flex-wrap justify-center gap-4 mb-10">
                            {['饮食计算', 'AI 动作矫正', '热量扫描', '体态分析', '极限估算'].map((item, i) => (
                                <span key={i} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-surface-300 text-sm font-medium">
                                    {item}
                                </span>
                            ))}
                        </div>

                        <div className="inline-flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                            <div className="flex items-center gap-2 text-orange-400 font-bold">
                                <Lock size={18} />
                                <span>早鸟福利 (Early Bird)</span>
                            </div>
                            <p className="text-sm text-surface-400">
                                首批注册用户将获得 <span className="text-white font-bold">永久优先使用权</span>
                                <br/>后续开放功能可能需付费订阅
                            </p>
                            <Button 
                                label="立即注册锁定权益" 
                                className="mt-2 bg-white text-surface-900 border-none font-bold hover:bg-surface-100 px-8 rounded-xl active:scale-95 transition-all"
                                onClick={() => router.push('/register')}
                            />
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}