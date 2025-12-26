'use client';

import React from 'react';
import { Info, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface ActivityNoticeProps {
    notice: string;
    className?: string;
}

export default function ActivityNotice({ notice, className }: ActivityNoticeProps) {
    if (!notice) return null;

    return (
        <div className={`relative overflow-hidden rounded-[2rem] bg-white border border-slate-100 shadow-[0_15px_40px_rgba(0,0,0,0.03)] ${className || ''}`}>
            
            {/* 装饰性背景：非常淡的 Primary 弥散渐变 */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
            
            {/* 左侧装饰：科技感线条修饰 */}
            <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col items-center justify-center py-8 z-20">
                <div className="w-full h-full bg-gradient-to-b from-transparent via-primary/40 to-transparent rounded-full" />
            </div>

            <div className="relative z-10 p-7 md:p-9 flex items-start gap-6 ml-1">
                {/* 图标容器：使用浅色底色 */}
                <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10">
                        <Info className="w-6 h-6 text-primary" />
                    </div>
                </div>

                <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-3">
                        {/* 标题：深色文字 + 品牌色分隔符 */}
                        <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">
                            特别说明 <span className="text-primary mx-1">/</span> 
                            <span className="text-slate-400 text-sm font-bold tracking-widest uppercase">Special Notice</span>
                        </h3>
                    </div>
                    
                    {/* 正文：Slate-600 确保在白底上的舒适可读性 */}
                    <div className="text-slate-600 leading-relaxed text-base font-medium antialiased">
                        {notice.split('\n').map((line, i) => (
                            <p key={i} className={i !== 0 ? "mt-3" : ""}>
                                {line}
                            </p>
                        ))}
                    </div>

                    {/* 底部功能性页脚：与整体风格一致的细分割线 */}
                    <div className="flex flex-wrap gap-6 mt-8 pt-6 border-t border-slate-50">
                        <div className="flex items-center text-xs font-black text-slate-400 uppercase tracking-widest">
                            <ShieldAlert className="w-4 h-4 mr-2 text-primary/50" />
                            官方认证挑战
                        </div>
                        <div className="flex items-center text-xs font-black text-slate-400 uppercase tracking-widest">
                            <CheckCircle2 className="w-4 h-4 mr-2 text-primary/50" />
                            公平竞技原则
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}