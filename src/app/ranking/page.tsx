'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Trophy, Target, Zap, Dumbbell } from 'lucide-react';

export default function RankingBanner() {
    const router = useRouter();

    const leaderboards = [
        { id: 'pullup', title: '负重引体向上', description: '查看谁是负重引体的王者！', icon: Target, route: '/ranking/pullup' },
        { id: 'bench', title: '卧推最大重量', description: '展示胸肌力量的巅峰对决！', icon: Dumbbell, route: '/ranking/bench-press' },
        { id: 'squat', title: '深蹲最大重量', description: '腿部力量的终极较量！', icon: Zap, route: '/ranking/squat' },
        { id: 'deadlift', title: '硬拉最大重量', description: '全身力量的极限挑战！', icon: Trophy, route: '/ranking/deadlift' },
    ];

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
                    const Icon = lb.icon;
                    return (
                        <div
                            key={lb.id}
                            className="flex flex-col items-center bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 cursor-pointer hover:shadow-xl transition-shadow"
                            onClick={() => router.push(lb.route)}
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
                                    router.push(lb.route);
                                }}
                            />
                        </div>
                    );
                })}
            </div>

        </div>
    );
}
