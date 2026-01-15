'use client';

import React from 'react';
import { Video, User, Trophy, Medal, Clock, Activity, Zap } from 'lucide-react';
import { LeaderboardFormInput } from '@/types/leaderboard';
import { LeaderboardEntryWithProfile } from '@/app/api/ranking/list-entries/entity';
import { Avatar } from 'primereact/avatar';

interface RankingsTableProps {
    entries: LeaderboardEntryWithProfile[];
    formSchema: LeaderboardFormInput[];
    rankByField?: string;
}

const RankingsTable = ({ entries, formSchema, rankByField }: RankingsTableProps) => {

    const getRankColor = (index: number) => {
        const rank = index + 1;
        if (rank === 1) return 'text-amber-500';
        if (rank === 2) return 'text-slate-400';
        if (rank === 3) return 'text-orange-600';
        return 'text-slate-200';
    };

    return (
        <div className="w-full mx-auto">
            {/* 1. 顶部标题区 - 极致冲击力 */}
            <div className="flex items-end justify-between mb-8 px-4">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                        <Zap className="w-4 h-4 text-primary fill-primary animate-pulse" />
                        <span className="text-xs font-black text-primary uppercase tracking-[0.3em]">Live Data</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tighter uppercase italic leading-none">
                        实时排名 <span className="text-slate-200 dark:text-slate-700 ml-2">/ RANKING</span>
                    </h2>
                </div>
                <div className="hidden md:block text-right">
                </div>
            </div>

            {/* 2. 列表区域 */}
            <div className="flex flex-col gap-3">
                {entries.map((entry, index) => {
                    const rankColor = getRankColor(index);

                    // --- 逻辑处理块 ---
                    const formData = (entry.form_data as unknown as LeaderboardFormInput[]) || [];

                    // 1. 核心成绩解析
                    const coreField = formData.find((f) => f.name === rankByField);
                    const coreValue = coreField?.userInput ?? entry.score;

                    // 2. 链接去重 (Map 保证唯一性)
                    const uniqueLinks = Array.from(
                        new Map<string, string>([
                            ...formData
                                .filter(f => typeof f.userInput === 'string' && f.userInput.trim().startsWith('http'))
                                .map(f => [f.userInput!.toString().trim(), 'VIDEO'] as [string, string]),
                            ...(entry.evidence_url ? [[entry.evidence_url.trim(), 'VIDEO'] as [string, string]] : [])
                        ])
                    );

                    // 3. 业务字段提取 (排除成绩字段和链接)
                    const metaData = formData.filter(f =>
                        f.name !== rankByField &&
                        !(typeof f.userInput === 'string' && f.userInput.trim().startsWith('http'))
                    );

                    return (
                        <div
                            key={entry.id}
                            className="group relative bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-3 md:px-6 md:py-3.5 shadow-sm transition-all hover:border-primary/30 overflow-hidden"
                        >
                            {/* 第一行：核心竞技数据 */}
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 md:gap-6 flex-1 min-w-0">
                                    {/* 排名 */}
                                    <div className="flex flex-col items-start min-w-[1.4rem] md:min-w-[2.8rem]">
                                        <span className={`text-2xl md:text-4xl font-black italic tracking-tighter leading-none ${rankColor}`}>
                                            {(index + 1).toString().padStart(2, '0')}
                                        </span>
                                    </div>

                                    {/* 用户信息 */}
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Avatar
                                            image={entry.userProfile?.avatar || undefined}
                                            label={
                                                entry.userProfile?.avatar
                                                    ? undefined
                                                    : (entry.userProfile?.name || (entry.extra_data as any)?.douyin_nickname)?.charAt(0) ||
                                                    'C'
                                            }
                                            shape="circle"
                                            className="bg-primary-500 text-surface font-bold flex-shrink-0"
                                            size="normal"
                                        />
                                        <h3 className="text-sm md:text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase italic leading-none">
                                            {entry.userProfile?.name || (entry.extra_data as any)?.douyin_nickname || '匿名挑战者'}
                                        </h3>
                                    </div>
                                </div>

                                {/* 核心成绩展现 */}
                                <div className="flex flex-col items-end leading-none">
                                    <span className="text-[7px] md:text-[8px] font-black uppercase tracking-tighter text-primary italic">
                                        {rankByField || 'RESULT'}
                                    </span>
                                    <div className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter italic leading-none mt-0.5">
                                        {coreValue}
                                    </div>
                                </div>
                            </div>

                            {/* 第二行：功能与属性填充 */}
                            <div className="mt-2.5 pt-2.5 border-t border-slate-50 dark:border-gray-800/50 flex items-center justify-between gap-4">

                                {/* 左侧：视频按钮 + 时间 */}
                                <div className="flex flex-wrap items-center gap-2">
                                    {/* 时间戳 */}
                                    <div className="flex items-center gap-1 text-[7px] md:text-[8px] font-black text-slate-400 bg-slate-50 dark:bg-gray-800 px-1.5 py-0.5 rounded uppercase">
                                        <Clock size={8} />
                                        {new Date(entry.created_at).toLocaleString('zh-CN', {
                                            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                                        }).replace(/\//g, '-')}
                                    </div>

                                    {/* 视频按钮渲染 */}
                                    {uniqueLinks.map(([url, label], i) => (
                                        <a
                                            key={i}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 dark:bg-primary text-white active:scale-95 transition-all shadow-sm"
                                        >
                                            <Video size={9} fill="currentColor" />
                                            <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest leading-none">
                                                {label}
                                            </span>
                                        </a>
                                    ))}
                                </div>

                                {/* 右侧：业务字段填充 */}
                                <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 overflow-hidden px-1">
                                    {metaData.slice(0, 2).map((item, i) => (
                                        <div key={i} className="flex items-baseline gap-1">
                                            <span className="text-[7px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-tighter">
                                                {item.name}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 italic leading-none whitespace-nowrap">
                                                {item.userInput || '-'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RankingsTable;