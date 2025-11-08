'use client';

import React from 'react';
import { Trophy, Target, Zap, Dumbbell } from 'lucide-react';

export default function RankingPage() {
    const leaderboards = [
        {
            id: 'pullup_leaderboard',
            title: '负重引体向上',
            description: '查看谁是负重引体的王者！',
            icon: Target,
            color: 'hover:'
        },
        {
            id: 'bench_press_leaderboard',
            title: '卧推最大重量',
            description: '展示胸肌力量的巅峰对决！',
            icon: Dumbbell,
            color: 'hover:'
        },
        {
            id: 'squat_leaderboard',
            title: '深蹲最大重量',
            description: '腿部力量的终极较量！',
            icon: Zap,
            color: 'hover:'
        },
        {
            id: 'deadlift_leaderboard',
            title: '硬拉最大重量',
            description: '全身力量的极限挑战！',
            icon: Trophy,
            color: 'hover:'
        }
    ];

    return (
        <div className="flex min-h-screen flex-col p-4 md:p-8">
            <div className="w-full max-w-6xl mx-auto">
                <div className="p-card p-component rounded-lg border">
                    <div className="p-card-body">
                        <h1 className="text-2xl md:text-3xl font-bold mb-6">排行榜</h1>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {leaderboards.map((leaderboard) => {
                                const IconComponent = leaderboard.icon;
                                return (
                                    <div
                                        key={leaderboard.id}
                                        className="rounded-lg shadow-lg p-6 cursor-pointer transition-all transform hover:scale-105"
                                    >
                                        <div className="flex items-center justify-center mb-4">
                                            <div className={`p-3 rounded-full ${leaderboard.color.split(' ')[0]} text-white`}>
                                                <IconComponent className="w-8 h-8" />
                                            </div>
                                        </div>
                                        <h2 className="text-xl font-semibold text-center mb-2">{leaderboard.title}</h2>
                                        <p className="text-center mb-4">{leaderboard.description}</p>
                                        <div className="flex justify-center">
                                            <button
                                                className={`${leaderboard.color} text-white font-bold py-2 px-6 rounded-full transition-colors`}
                                            >
                                                查看排行榜
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}