'use client';

import React from 'react';
import { Video, User, Trophy, Medal, Clock, Activity, Zap, ChevronRight, Play } from 'lucide-react';
import { LeaderboardFormInput } from '@/types/leaderboard';
import { LeaderboardEntryWithProfile } from '@/app/api/ranking/list-entries/entity';
import { RankingsTableItem } from './RankingsTableItem';

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
                    // 2. 链接去重 (Map 保证唯一性)
                    const uniqueLinks = Array.from(
                        new Map<string, string>([
                            ...formData
                                .filter(f => {
                                    const val = f.userInput?.toString().trim();
                                    // 严格校验：必须以 http 开头，且能被解析为合法 URL
                                    if (!val || !val.startsWith('http')) return false;
                                    try {
                                        new URL(val);
                                        return true;
                                    } catch {
                                        return false;
                                    }
                                })
                                .map(f => [f.userInput!.toString().trim(), 'VIDEO'] as [string, string]),

                            // 同样对 evidence_url 进行安全检查
                            ...(entry.evidence_url?.trim().startsWith('http')
                                ? [[entry.evidence_url.trim(), 'VIDEO'] as [string, string]]
                                : [])
                        ])
                    );

                    // 3. 业务字段提取 (排除成绩字段和链接)
                    const metaData = formData.filter(f =>
                        f.name !== rankByField &&
                        !(typeof f.userInput === 'string' && f.userInput.trim().startsWith('http'))
                    );

                    return (
                        <RankingsTableItem
                            key={entry.id}
                            entry={entry}
                            index={index}
                            rankColor={rankColor}
                            rankByField={rankByField}
                            coreValue={coreValue}
                            uniqueLinks={uniqueLinks}
                            metaData={metaData as any}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default RankingsTable;