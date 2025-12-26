'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Trophy, Target, Zap, Dumbbell, Users, ChevronRight } from 'lucide-react';
import { rankingService } from '@/app/service/rankingService';
import { ListLeaderboardItem } from '../api/ranking/list-leaderboard/entity';

export default function RankingBanner() {
    const router = useRouter();
    const [leaderboards, setLeaderboards] = useState<ListLeaderboardItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLeaderboards();
    }, []);

    async function loadLeaderboards() {
        try {
            setLoading(true);
            const res = await rankingService.listLeaderboard({ page: 1, limit: 10, countStatus: 'approved' });
            if (res) {
                const boards = res.leaderboards || [];
                boards.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                setLeaderboards(boards);
            }
        } catch (error) {
            console.error('加载排行榜失败:', error);
        } finally {
            setLoading(false);
        }
    }

    // 提取图标逻辑
    const getIcon = (type: string) => {
        switch (type) {
            case 'time': return <Target className="w-6 h-6" />;
            case 'weight': return <Dumbbell className="w-6 h-6" />;
            case 'reps': return <Zap className="w-6 h-6" />;
            default: return <Trophy className="w-6 h-6" />;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center p-6 md:p-12 gap-8 animate-pulse">
                <div className="w-full max-w-6xl h-64 bg-gray-200 dark:bg-gray-700 rounded-3xl" />
                <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, idx) => (
                        <div key={idx} className="h-48 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center p-4 md:p-8 gap-12 bg-gray-50/50 dark:bg-transparent min-h-screen">
            
            {/* 核心 Banner - 更加聚焦运动感 */}
            <div className="relative w-full max-w-6xl overflow-hidden rounded-[2.5rem] bg-slate-900 shadow-2xl group">
                {/* 装饰性背景 */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-colors" />
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
                
                <div className="relative z-10 p-10 md:p-20 flex flex-col items-center text-center">
                    <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-primary-200 text-sm mb-6 animate-bounce">
                        <Trophy className="w-4 h-4 mr-2" /> 
                        挑战已开启
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tight">
                        COACHLINK <span className="text-primary">RANKING</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-slate-300 max-w-2xl leading-relaxed">
                        记录你的每一次超越。在这个赛场上，汗水是唯一的入场券，实力是最高的话语权。
                    </p>
                </div>
            </div>

            {/* 排行榜网格 */}
            <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {leaderboards.map((lb) => (
                    <div
                        key={lb.id}
                        className="group relative flex flex-col bg-white dark:bg-gray-800/50 backdrop-blur-sm 
                                   border border-gray-100 dark:border-gray-700 rounded-2xl p-6 
                                   hover:border-primary/50 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
                        onClick={() => router.push(`/ranking/${lb.id}`)}
                    >
                        {/* 顶部图标与统计 */}
                        <div className="flex justify-between items-start mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary 
                                          group-hover:bg-primary group-hover:text-white transition-colors duration-500 shadow-inner">
                                {getIcon(lb.type)}
                            </div>
                            <div className="flex items-center text-gray-400 text-xs font-medium">
                                <Users className="w-3.5 h-3.5 mr-1" />
                                已参与: {lb.statusCount || 0}
                            </div>
                        </div>

                        {/* 内容 */}
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-primary transition-colors">
                                {lb.title}
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6 line-clamp-2">
                                {lb.description || '暂无描述，参与挑战展现你的实力吧！'}
                            </p>
                        </div>

                        {/* 底部按钮交互 */}
                        <div className="pt-4 border-t border-gray-50 dark:border-gray-700 flex items-center justify-between group/btn">
                            <span className="text-sm font-semibold text-primary">立即挑战</span>
                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center 
                                          group-hover:bg-primary group-hover:text-white transition-all">
                                <ChevronRight className="w-5 h-5" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* 脚注提示 */}
            <p className="text-gray-400 text-sm italic">
                * 排行榜实时更新，确保您的数据真实有效
            </p>
        </div>
    );
}