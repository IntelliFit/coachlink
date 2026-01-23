import React from 'react';
import { Avatar } from 'primereact/avatar';
import { Clock, Dumbbell, Timer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

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
        };
    };
}

export const ActivityCard: React.FC<ActivityCardProps> = ({ activity }) => {
    const router = useRouter();
    const { user, execution } = activity;

    const handleClick = () => {
        if (execution.shareToken) {
            router.push(`/public/training/${execution.shareToken}`);
        }
    };

    return (
        <div 
            className="bg-surface-0 p-4 rounded-xl shadow-sm border border-surface-100 mb-3 cursor-pointer hover:shadow-md transition-all active:scale-[0.99]"
            onClick={handleClick}
        >
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
                <Avatar 
                    image={user.avatarUrl} 
                    label={!user.avatarUrl ? user.nickname?.[0]?.toUpperCase() : undefined}
                    shape="circle" 
                    className="bg-primary-100 text-primary-600"
                />
                <div className="flex-1">
                    <div className="flex justify-between items-start">
                        <h3 className="font-bold text-surface-900 text-sm">{user.nickname}</h3>
                        <span className="text-xs text-surface-400">
                            {formatDistanceToNow(new Date(execution.completedAt), { addSuffix: true, locale: zhCN })}
                        </span>
                    </div>
                    <p className="text-xs text-surface-500">完成了训练</p>
                </div>
            </div>

            {/* Content */}
            <div className="bg-surface-50 rounded-lg p-3">
                <h4 className="font-bold text-primary-500 mb-2 text-sm">
                    {execution.planName} · Day {execution.dayIndex}
                </h4>
                
                <div className="flex gap-4 text-xs text-surface-600">
                    <div className="flex items-center gap-1">
                        <Timer className="w-3 h-3" />
                        <span>{execution.durationMinutes}分钟</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Dumbbell className="w-3 h-3" />
                        <span>{Math.round(execution.totalVolume).toLocaleString()}kg</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
