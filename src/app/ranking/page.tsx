'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Trophy, Target, Zap, Dumbbell } from 'lucide-react';
import { rankingService } from '@/app/service/rankingService';

export default function RankingBanner() {
    const router = useRouter();
    const [leaderboards, setLeaderboards] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLeaderboards();
    }, []);

    async function loadLeaderboards() {
        try {
            setLoading(true);
            const res = await rankingService.listLeaderboard({ page: 1, limit: 10 });
            if (res) {
                setLeaderboards(res.leaderboards || []);
            }
        } catch (error) {
            console.error('加载排行榜失败:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center p-4 md:p-8 gap-8">
                <div className="w-full max-w-6xl rounded-3xl p-8 md:p-16 flex flex-col items-center text-center
                           bg-gradient-to-r from-primary to-primary-900 shadow-xl">
                    <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
                        CoachLink 排行榜
                    </h1>
                    <p className="text-lg md:text-xl text-white/90">
                        查看谁是健身王者，挑战你的训练极限！
                    </p>
                </div>
                
                <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[...Array(4)].map((_, idx) => (
                        <div key={idx} className="flex flex-col items-center bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white mb-4">
                                <div className="w-6 h-6 bg-gray-300 rounded-full" />
                            </div>
                            <div className="h-6 bg-gray-200 rounded w-3/4 mb-1 text-center"></div>
                            <div className="h-4 bg-gray-200 rounded w-4/5 mb-4 text-center"></div>
                            <div className="h-10 bg-gray-200 rounded w-full"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center p-4 md:p-8 gap-8">
            {/* Banner */}
            <div
                className="w-full max-w-6xl rounded-3xl p-8 md:p-16 flex flex-col items-center text-center
                           bg-gradient-to-r from-primary to-primary-900 shadow-xl"
            >
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
                    CoachLink 排行榜
                </h1>
                <p className="text-lg md:text-xl text-white/90">
                    查看谁是健身王者，挑战你的训练极限！
                </p>
            </div>

            {/* 排行榜按钮网格 */}
            <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-6">
                {leaderboards.map((lb) => {
                    // 根据排行榜类型选择图标
                    let Icon;
                    switch(lb.type) {
                        case 'time':
                            Icon = Target;
                            break;
                        case 'weight':
                            Icon = Dumbbell;
                            break;
                        case 'reps':
                            Icon = Zap;
                            break;
                        default:
                            Icon = Trophy;
                    }
                    
                    return (
                        <div
                            key={lb.id}
                            className="flex flex-col items-center bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 cursor-pointer hover:shadow-xl transition-shadow"
                            onClick={() => router.push(`/ranking/${lb.id}`)}
                        >
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white mb-4">
                                <Icon className="w-6 h-6" />
                            </div>
                            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-1 text-center">{lb.title}</h2>
                            <p className="text-gray-600 dark:text-gray-300 text-sm text-center mb-4">{lb.description}</p>
                            <Button
                                label="查看排行榜"
                                className="p-button-sm p-button-primary w-full"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/ranking/${lb.id}`);
                                }}
                            />
                        </div>
                    );
                })}
            </div>

        </div>
    );
}