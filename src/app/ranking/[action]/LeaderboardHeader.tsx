import React from 'react';
import { Trophy, Calendar, Users } from 'lucide-react';
import { Button } from 'primereact/button';

interface LeaderboardHeaderProps {
    recordCount: number;
    onShowSubmissionDialog: () => void;
    onRefreshLeaderboard: () => void;
}

export default function LeaderboardHeader({ recordCount, onShowSubmissionDialog, onRefreshLeaderboard }: LeaderboardHeaderProps) {
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
                            负重引体之王
                        </h1>
                        <p className="text-base md:text-lg text-surface/90 tracking-wide">
                            月度排行榜挑战赛
                        </p>
                    </div>

                    {/* 右侧操作按钮区 */}
                    <div className="flex flex-wrap justify-center md:justify-end gap-3 sm:gap-4">
                        <Button
                            label="提交我的记录"
                            icon="pi pi-upload"
                            onClick={onShowSubmissionDialog}
                        />
                        <Button
                            label="刷新排行榜"
                            icon="pi pi-refresh"
                            onClick={onRefreshLeaderboard}
                        />
                    </div>
                </div>


                {/* 信息子卡片区域 */}
                <div
                    className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-8 w-full max-w-4xl"
                >
                    {[
                        { icon: <Calendar className="w-6 h-6" />, title: '活动时间', value: '永久有效' },
                        { icon: <Users className="w-6 h-6" />, title: '参与人数', value: `${recordCount} 位挑战者` },
                        { icon: <Trophy className="w-6 h-6" />, title: '发起人', value: '刘三乐（17项吉尼斯纪录保持者）' },
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