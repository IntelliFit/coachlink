import React from 'react';
import { Trophy, Calendar, Users, User } from 'lucide-react';
import { Button } from 'primereact/button';

interface LeaderboardHeaderProps {
    title: string;
    description: string;
    startAt?: string | null;
    endAt?: string | null;
    recordCount?: number;
    ownerName?: string;
}

export default function LeaderboardHeader({ title, description, startAt, endAt, recordCount = 0, ownerName = '系统' }: LeaderboardHeaderProps) {
    // 格式化时间
    const formatTimeRange = () => {
        if (!startAt && !endAt) {
            return '永久有效';
        }
        
        const start = startAt ? new Date(startAt).toLocaleDateString() : '无限制';
        const end = endAt ? new Date(endAt).toLocaleDateString() : '无限制';
        
        return `${start} - ${end}`;
    };

    return (
        <div
            className="relative w-full max-w-6xl mx-auto rounded-3xl overflow-hidden bg-gradient-to-r from-primary to-primary-900
                    text-surface shadow-2xl p-8 md:p-16 flex flex-col items-center text-center"
        >
            {/* 主体内容 */}
            <div className="relative z-10 flex flex-col items-center space-y-4">

                <div className="flex flex-col md:flex-row items-center justify-between w-full max-w-5xl mx-auto text-center md:text-left gap-6 md:gap-10">
                    {/* 左侧标题区 */}
                    <div className="flex flex-col items-center md:items-start space-y-2">
                        <h1 className="text-4xl md:text-6xl font-extrabold flex items-center gap-3 drop-shadow-sm">
                            <Trophy className="w-12 h-12 md:w-16 md:h-16 text-yellow-300 drop-shadow" />
                            {title}
                        </h1>
                        <p className="text-base md:text-lg text-surface/90 tracking-wide">
                            {description}
                        </p>
                    </div>

                    <Button>
                        
                    </Button>
                </div>

                {/* 信息子卡片区域 */}
                <div
                    className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-8 w-full max-w-4xl"
                >
                    {[
                        { 
                            icon: <Calendar className="w-6 h-6" />, 
                            title: '活动时间', 
                            value: formatTimeRange() 
                        },
                        { 
                            icon: <Users className="w-6 h-6" />, 
                            title: '参与人数', 
                            value: `${recordCount} 位挑战者` 
                        },
                        { 
                            icon: <User className="w-6 h-6" />, 
                            title: '发起人', 
                            value: ownerName 
                        },
                    ].map((item, idx) => (
                        <div
                            key={idx}
                            className="flex flex-col items-center justify-center text-center rounded-2xl
                               bg-white/10 backdrop-blur-sm p-5 sm:p-6 shadow-lg
                               border border-white/20 hover:bg-white/15 transition-all"
                        >
                            <div className="flex items-center justify-center mb-2 text-yellow-300">
                                {item.icon}
                            </div>
                            <h3 className="font-semibold text-surface text-base sm:text-lg mb-1">
                                {item.title}
                            </h3>
                            <p className="text-surface/90 text-sm sm:text-base">{item.value}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}