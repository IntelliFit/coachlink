'use client';

import React from 'react';
import { Info, ShieldAlert, CheckCircle2, MessageSquare } from 'lucide-react';

interface ActivityNoticeProps {
    notice: string;
    className?: string;
}

export default function ActivityNotice({ notice, className }: ActivityNoticeProps) {
    if (!notice) return null;

    return (
        <div className={`relative overflow-hidden bg-surface dark:bg-gray-800 border border-slate-100 dark:border-gray-700 rounded-[2rem] p-6 md:p-8 shadow-[0_15px_40px_rgba(0,0,0,0.03)] ${className || ''}`}>
            
            {/* 顶部修饰线：严格对齐 ActivityInfo 右侧 */}
            <div className="absolute top-0 left-10 right-10 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

            {/* 标题部分：严格对齐标准 */}
            <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-xl bg-primary/5 text-primary">
                    <MessageSquare className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">
                    特别说明 <span className="text-slate-300 ml-1 text-sm font-bold tracking-widest">/ NOTICE</span>
                </h2>
            </div>

            {/* 正文内容：严格对齐 ActivityInfo 左侧的引导线排版 */}
            <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/10 rounded-full" />
                <div className="pl-5 text-slate-600 dark:text-slate-300 text-base leading-relaxed font-medium antialiased">
                    {notice.split('\n').map((line, i) => (
                        <p key={i} className={i !== 0 ? "mt-3" : ""}>
                            {line}
                        </p>
                    ))}
                </div>
            </div>

            {/* 底部功能性页脚：保持细分割线风格 */}
            <div className="flex flex-wrap gap-6 mt-8 pt-6 border-t border-slate-50 dark:border-slate-700/50">
                <div className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    <ShieldAlert className="w-4 h-4 mr-2 text-primary/40" />
                    官方认证挑战
                </div>
                <div className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-primary/40" />
                    公平竞技原则
                </div>
            </div>
        </div>
    );
}