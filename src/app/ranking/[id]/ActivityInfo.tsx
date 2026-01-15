'use client';

import React from 'react';
import { Star, Target, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

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
            <div className="relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-50 dark:border-gray-700 rounded-[2rem] p-6 md:p-8 shadow-[0_15px_40px_rgba(0,0,0,0.03)]">
                <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900 text-amber-500">
                        <Star className="w-5 h-5 fill-amber-500" />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">
                        活动介绍 <span className="text-slate-300 ml-1 text-sm font-bold tracking-widest">/ INTRO</span>
                    </h2>
                </div>

                <div className="relative">
                    {/* 标志性引导线 */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/10 rounded-full" />
                    <div className="pl-5 text-slate-600 dark:text-slate-100 text-base leading-relaxed font-medium antialiased">
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

            {/* 右侧：评判标准 (已修改为与左侧完全一致) */}
            <div className="relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-50 dark:border-gray-700 rounded-[2rem] p-6 md:p-8 shadow-[0_15px_40px_rgba(0,0,0,0.03)]">
                <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900 text-blue-500">
                        <Target className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">
                        评判标准 <span className="text-slate-300 ml-1 text-sm font-bold tracking-widest">/ RULES</span>
                    </h2>
                </div>

                <div className="relative">
                    {/* 标志性引导线 - 保持一致 */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/10 rounded-full" />
                    
                    {/* 规则列表 */}
                    <div className="pl-5 flex flex-col gap-3">
                        {displayRules.map((rule, idx) => (
                            <div key={idx} className="flex items-start gap-3 group">
                                <div className="mt-1 flex-shrink-0">
                                    {rule.status === 'success' ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    ) : rule.status === 'warning' ? (
                                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                                    ) : (
                                        <XCircle className="w-4 h-4 text-rose-500" />
                                    )}
                                </div>
                                <p className="text-slate-600 dark:text-slate-100 text-sm font-bold leading-tight flex-1">
                                    {rule.detail}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}