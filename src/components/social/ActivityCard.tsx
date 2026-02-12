import React from 'react';
import { Avatar } from 'primereact/avatar';
import { Card } from 'primereact/card';
import { ChevronRight, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const AERO_CARD = "px-3 py-5 rounded-3xl border border-surface-100 bg-surface-0 shadow-[0_1px_0_rgba(15,23,42,0.02)] hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)] transition-[box-shadow,transform]";

interface ActivityCardProps {
    activity: {
        id: string;
        user: {
            userId: string;
            nickname: string;
            avatarUrl?: string;
        };
        execution: {
            executionId: string;
            planName: string;
            dayIndex: number;
            totalVolume: number;
            durationMinutes: number;
            completedAt: string;
            shareToken?: string;
            highlight?: {
                actionName: string;
                weight: number;
                reps: number;
            } | null;
        };
    };
}

export const ActivityCard: React.FC<ActivityCardProps> = ({ activity }) => {
    const router = useRouter();
    const { user, execution } = activity;
    const { highlight } = execution;

    const handleClick = () => {
        if (execution.shareToken) {
            router.push(`/public/training/${execution.shareToken}`);
        }
    };

    const hasShareToken = !!execution.shareToken;

    return (
        <div
            className={`${AERO_CARD} ${hasShareToken ? 'cursor-pointer active:scale-[0.98]' : ''}`}
            onClick={hasShareToken ? handleClick : undefined}
        >
            <div className="flex items-center gap-3">
                {/* 头像 */}
                <Avatar
                    image={user.avatarUrl}
                    label={!user.avatarUrl ? user.nickname?.[0]?.toUpperCase() : undefined}
                    shape="circle"
                    className="!w-9 !h-9 bg-surface-100 text-surface-600 text-xs font-bold shrink-0"
                />

                {/* 主要内容 */}
                <div className="flex-1 min-w-0">
                    {/* 第一行：用户 + 时间 */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-sm min-w-0">
                            <span className="font-bold text-surface-900 truncate">{user.nickname}</span>
                            <span className="text-surface-400 shrink-0">完成了</span>
                            <span className="text-surface-600 truncate">{execution.planName}</span>
                        </div>
                        <span className="text-xs text-surface-400 shrink-0">
                            {formatDistanceToNow(new Date(execution.completedAt), { addSuffix: false, locale: zhCN })}
                        </span>
                    </div>

                    {/* 第二行：亮点动作 - 突出显示 */}
                    {highlight && (
                        <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex items-center gap-1.5 bg-surface-100 px-2.5 py-1 rounded-xl">
                                <Zap className="w-3.5 h-3.5 text-surface-500" />
                                <span className="text-xs font-semibold text-surface-700">{highlight.actionName}</span>
                            </div>
                            {/* 重量 badge - 主题色透明背景 */}
                            <div className="flex items-center gap-1 bg-primary-500/15 px-2.5 py-1 rounded-xl">
                                <span className="text-xs font-black text-primary-600">{highlight.weight}kg</span>
                                <span className="text-xs text-primary-500/70">×{highlight.reps}</span>
                            </div>
                            <span className="text-xs text-surface-400">
                                {Math.round(execution.totalVolume / 1000 * 10) / 10}t · {execution.durationMinutes}min
                            </span>
                        </div>
                    )}

                    {/* 没有亮点时的简化显示 */}
                    {!highlight && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-surface-500">
                            <span>D{execution.dayIndex}</span>
                            <span>·</span>
                            <span>{Math.round(execution.totalVolume / 1000 * 10) / 10}t</span>
                            <span>·</span>
                            <span>{execution.durationMinutes}min</span>
                        </div>
                    )}
                </div>

                {/* 箭头 */}
                {hasShareToken && (
                    <ChevronRight className="w-4 h-4 text-surface-300 shrink-0" />
                )}
            </div>
        </div>
    );
};
