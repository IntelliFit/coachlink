'use client';

import React, { useState } from 'react';
import { Trophy, Calendar, Users, User, ArrowUpRight, Zap } from 'lucide-react';
import { Button } from 'primereact/button';
import SubmissionDialog from './SubmissionDialog';

interface LeaderboardHeaderProps {
    title: string;
    description: string;
    startAt?: string | null;
    endAt?: string | null;
    recordCount?: number;
    ownerName?: string;
    formSchema?: any[];
    templateId?: string;
}

export default function LeaderboardHeader({
    title,
    description,
    startAt,
    endAt,
    recordCount = 0,
    ownerName = '系统',
    formSchema,
    templateId
}: LeaderboardHeaderProps) {

    const formatTimeRange = () => {
        if (!startAt && !endAt) return '不限时挑战';
        const start = startAt ? new Date(startAt).toLocaleDateString() : '∞';
        const end = endAt ? new Date(endAt).toLocaleDateString() : '∞';
        return `${start} — ${end}`;
    };

    const [showSubmissionDialog, setShowSubmissionDialog] = useState(false);

    return (
        <div className="relative w-full max-w-6xl mx-auto mb-10 group px-4">
            
            {/* 1. 主容器：大胆的 Primary 渐变底色 */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-500 to-primary-700 rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(var(--primary-rgb),0.3)]" />
            
            {/* 2. 装饰性流体背景：增加深度感 */}
            <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden">
                {/* 动态光晕 */}
                <div className="absolute -top-24 -right-24 w-[30rem] h-[30rem] bg-white/10 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute top-1/2 -left-20 w-80 h-80 bg-black/10 rounded-full blur-[80px]" />
                
                {/* 极细网格纹理：增加工业/精密感 */}
                <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:30px_30px]" />
            </div>

            <div className="relative z-10 p-8 md:p-14 lg:p-16 flex flex-col items-center">
                
                {/* 顶部内容区 */}
                <div className="flex flex-col md:flex-row items-center justify-between w-full gap-8 mb-16">
                    <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-5 flex-1">
                        
                        {/* 状态徽章：高亮的玻璃质感 */}
                        <div className="inline-flex items-center px-4 py-1.5 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-black tracking-[0.2em] uppercase shadow-lg">
                            <Zap className="w-3.5 h-3.5 mr-2 fill-white animate-pulse" />
                            Live Ranking
                        </div>
                        
                        {/* 标题：白色高亮 + 阴影 */}
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tighter uppercase leading-none drop-shadow-2xl">
                            {title}
                        </h1>
                        
                        {/* 描述：浅白色，增加易读性 */}
                        <p className="text-lg md:text-xl text-white/80 max-w-xl leading-relaxed font-medium">
                            {description}
                        </p>
                    </div>

                    <div className="flex-shrink-0">
                        {/* 核心行动按钮：反转色 (白底黑字或深色字) 以产生最强对比 */}
                        <Button
                            onClick={() => setShowSubmissionDialog(true)}
                            className="group/btn relative overflow-hidden bg-white hover:bg-slate-50 text-primary-700 border-none py-4 px-10 rounded-2xl font-black shadow-2xl transition-all duration-300 transform active:scale-95"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-lg tracking-tight uppercase">提交记录</span>
                                <ArrowUpRight className="w-5 h-5 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
                            </div>
                        </Button>
                    </div>
                </div>

                {/* 底部属性区域：深色半透明玻璃化 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full pt-10 border-t border-white/20">
                    {[
                        {
                            icon: <Calendar className="w-5 h-5" />,
                            title: '挑战周期',
                            value: formatTimeRange(),
                        },
                        {
                            icon: <Users className="w-5 h-5" />,
                            title: '参与人数',
                            value: `${recordCount} 位`,
                        },
                        {
                            icon: <User className="w-5 h-5" />,
                            title: '发起人',
                            value: ownerName,
                        },
                    ].map((item, idx) => (
                        <div
                            key={idx}
                            className="flex items-center space-x-5 rounded-2xl bg-white/10 backdrop-blur-md p-6 
                                     border border-white/10 hover:border-white/40 hover:bg-white/20 transition-all duration-300"
                        >
                            <div className="p-3 rounded-xl bg-white text-primary-600 shadow-xl">
                                {item.icon}
                            </div>

                            <div className="text-left flex-1 min-w-0">
                                <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] mb-1">
                                    {item.title}
                                </p>
                                <p className="text-white text-base font-bold truncate tracking-tight">
                                    {item.value}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {templateId && formSchema && (
                <SubmissionDialog
                    visible={showSubmissionDialog}
                    onHide={() => setShowSubmissionDialog(false)}
                    templateId={templateId}
                    formSchema={formSchema}
                    onSuccess={() => setShowSubmissionDialog(false)}
                />
            )}
        </div>
    );
}