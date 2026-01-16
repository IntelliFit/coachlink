'use client';

import React, { useState } from 'react';
import { ChevronDown, TrendingUp } from 'lucide-react';
import { E1RMProgressChart } from './E1RMProgressChart';

export const StrengthProgressSection = ({ session, subscription }: any) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className={`
            bg-white rounded-[24px] border border-surface-100 transition-all duration-300
            ${isExpanded ? 'shadow-[0_12px_40px_rgba(0,0,0,0.08)]' : 'shadow-sm'}
        `}>
            {/* 头部区域：点击触发折叠 */}
            <div 
                className="flex items-center justify-between p-4 cursor-pointer select-none"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className={`
                        p-2 rounded-xl transition-all duration-500
                        ${isExpanded ? 'bg-primary-50 text-primary scale-110' : 'bg-surface-50 text-surface-400'}
                    `}>
                        <TrendingUp size={18} strokeWidth={3} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-black text-surface-900 italic tracking-tight uppercase leading-none">
                            力量进步曲线
                        </span>
                        {!isExpanded && (
                            <span className="text-[10px] font-bold text-surface-400 mt-1">
                                追踪您的 E1RM 增长趋势
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* 折叠状态下的简单视觉暗示 */}
                    {!isExpanded && (
                        <span className="text-[10px] font-black text-primary bg-primary-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
                            data
                        </span>
                    )}
                    <ChevronDown 
                        size={16} 
                        className={`text-surface-300 transition-transform duration-500 ${isExpanded ? 'rotate-180 text-primary' : ''}`} 
                    />
                </div>
            </div>

            {/* 内容区域：Grid 动画方案 */}
            <div className={`
                grid transition-all duration-300 ease-in-out
                ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}
            `}>
                <div className="overflow-hidden">
                    <div className="px-3 pb-4 sm:px-5 sm:pb-5">
                        {/* 内部装饰线 */}
                        <div className="h-[1px] bg-surface-50 w-full mb-4" />
                        
                        <div className="bg-surface-50/30 rounded-2xl p-2 border border-surface-50">
                            <E1RMProgressChart
                                studentId={session?.user.id as string}
                                coachId={subscription?.coach_id}
                                height="200px" // 稍微增加高度，让曲线更清晰
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};