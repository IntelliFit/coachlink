import React from 'react';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { Card } from 'primereact/card';
import { Check, X, Clock } from 'lucide-react';
import { diffBeijingCalendarDays, formatBeijingDate } from '@/lib/beijingTime';

const AERO_CARD = "rounded-3xl border border-surface-100 bg-surface-0 shadow-[0_1px_0_rgba(15,23,42,0.02)] hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition-[box-shadow,transform]";

interface FriendRequestCardProps {
    request: {
        friendshipId: string;
        requester: {
            userId: string;
            nickname: string;
            avatarUrl?: string;
        };
        createdAt: string;
        message?: string;
    };
    onAccept: (id: string) => void;
    onReject: (id: string) => void;
    loading?: boolean;
}

export const FriendRequestCard: React.FC<FriendRequestCardProps> = ({ 
    request, 
    onAccept, 
    onReject,
    loading = false
}) => {
    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = diffBeijingCalendarDays(now, date);

        if (diffMins < 1) return '刚刚';
        if (diffMins < 60) return `${diffMins} 分钟前`;
        if (diffHours < 24) return `${diffHours} 小时前`;
        if (diffDays < 7) return `${diffDays} 天前`;
        return formatBeijingDate(date, 'zh-CN', { month: 'short', day: 'numeric' });
    };

    return (
        <Card className={AERO_CARD}>
            <div className="p-4">
                <div className="flex items-start gap-4">
                    {/* 头像 + 新请求指示 */}
                    <div className="relative">
                        <Avatar 
                            image={request.requester.avatarUrl} 
                            label={!request.requester.avatarUrl ? request.requester.nickname?.[0]?.toUpperCase() : undefined}
                            shape="circle" 
                            className="!w-12 !h-12 bg-surface-100 text-surface-600 text-lg font-bold border-2 border-primary-200"
                        />
                        {/* 小圆点指示 - 更克制的设计 */}
                        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary-500 border-2 border-surface-0" />
                    </div>

                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-surface-900 truncate">{request.requester.nickname}</span>
                        </div>
                        <div className="text-sm text-surface-600 mt-0.5">请求添加你为好友</div>
                        <div className="flex items-center gap-1 text-xs text-surface-400 mt-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatTimeAgo(request.createdAt)}</span>
                        </div>
                    </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2 mt-4">
                    <Button 
                        icon={<Check className="w-4 h-4" />}
                        label="接受"
                        className="flex-1 !h-10 !rounded-2xl bg-surface-900 border-none text-surface-0 text-sm font-bold hover:bg-surface-800 active:scale-[0.98] transition-all"
                        onClick={() => onAccept(request.friendshipId)}
                        disabled={loading}
                    />
                    <Button 
                        icon={<X className="w-4 h-4" />}
                        label="拒绝"
                        outlined
                        className="flex-1 !h-10 !rounded-2xl border-surface-200 text-surface-600 text-sm font-bold hover:bg-surface-50 hover:border-surface-300 active:scale-[0.98] transition-all"
                        onClick={() => onReject(request.friendshipId)}
                        disabled={loading}
                    />
                </div>
            </div>
        </Card>
    );
};
