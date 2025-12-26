'use client';

import React from 'react';
import { Star, Target, CheckCircle2, XCircle, AlertTriangle, ChevronRight } from 'lucide-react';

interface ActivityInfoProps {
    description: string;
    rules: any[];
}

export default function ActivityInfo({ description, rules }: ActivityInfoProps) {
    const defaultRules = [
        { status: 'success', detail: '一镜到底，视频禁止任何后期剪辑或调速。' },
        { status: 'success', detail: '起始动作手臂需完全伸直，动作终点下巴必须明显过杠。' },
        { status: 'error', detail: '严禁任何形式的借力动作，如甩腿、踢膝或脚尖蹬地。' },
        { status: 'warning', detail: '负重级别挑战需在视频开头展示负重块实称重量。' },
    ];

    const displayRules = rules && rules.length > 0 ? rules : defaultRules;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左侧：活动介绍 */}
            <div className="relative overflow-hidden bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8 shadow-[0_15px_40px_rgba(0,0,0,0.03)]">
                {/* 顶部微弱装饰线 */}
                <div className="absolute top-0 left-10 right-10 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                
                <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-500">
                        <Star className="w-5 h-5 fill-amber-500" />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">
                        活动介绍 <span className="text-slate-300 ml-1 text-sm font-bold tracking-widest">/ INTRO</span>
                    </h2>
                </div>

                <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/10 rounded-full" />
                    <div className="pl-5 text-slate-600 text-base leading-relaxed font-medium antialiased">
                        {description ? (
                            <p>{description}</p>
                        ) : (
                            <p className="text-slate-400">
                                记录每一次突破，让实力被所有人看见。
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* 右侧：评判标准 */}
            <div className="relative overflow-hidden bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8 shadow-[0_15px_40px_rgba(0,0,0,0.03)]">
                <div className="absolute top-0 left-10 right-10 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

                <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 rounded-xl bg-primary/5 text-primary">
                        <Target className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">
                        评判标准 <span className="text-slate-300 ml-1 text-sm font-bold tracking-widest">/ RULES</span>
                    </h2>
                </div>

                {/* 降低了间距从 gap-4 变为 gap-2 */}
                <div className="flex flex-col gap-2">
                    {displayRules.map((rule, idx) => (
                        <div 
                            key={idx} 
                            className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/50 border border-transparent hover:border-slate-100 hover:bg-white transition-all duration-200 group"
                        >
                            <div className="flex-shrink-0">
                                {rule.status === 'success' ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                ) : rule.status === 'warning' ? (
                                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                                ) : (
                                    <XCircle className="w-4 h-4 text-rose-500" />
                                )}
                            </div>
                            <p className="text-slate-700 text-sm font-bold leading-tight flex-1">
                                {rule.detail}
                            </p>
                            <ChevronRight className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}