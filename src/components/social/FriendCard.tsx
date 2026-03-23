import React from 'react';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { Card } from 'primereact/card';
import { UserMinus, ChevronRight, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatBeijingDate } from '@/lib/beijingTime';

const AERO_CARD = "px-3 py-5 rounded-3xl border border-surface-100 bg-surface-0 shadow-[0_1px_0_rgba(15,23,42,0.02)] hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition-[box-shadow,transform]";

interface FriendCardProps {
    friend: {
        userId: string;
        nickname: string;
        avatarUrl?: string;
        friendsSince?: string;
    };
    onRemove?: (id: string) => void;
}

export const FriendCard: React.FC<FriendCardProps> = ({ friend, onRemove }) => {
    const router = useRouter();

    const formatDate = (dateString: string) => {
        return formatBeijingDate(dateString, 'zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    return (
        <div className={AERO_CARD}>
            <div className="flex items-center gap-4">
                {/* 头像 */}
                <div
                    className="cursor-pointer active:scale-[0.98] transition-transform"
                    onClick={() => router.push(`/user/${friend.userId}`)}
                >
                    <Avatar
                        image={friend.avatarUrl}
                        label={!friend.avatarUrl ? friend.nickname?.[0]?.toUpperCase() : undefined}
                        shape="circle"
                        className="!w-12 !h-12 bg-surface-100 text-surface-600 text-lg font-bold border-2 border-surface-100"
                    />
                </div>

                {/* 信息 */}
                <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => router.push(`/user/${friend.userId}`)}
                >
                    <div className="font-bold text-surface-900 truncate">{friend.nickname}</div>
                    {friend.friendsSince && (
                        <div className="flex items-center gap-1 text-xs text-surface-500 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDate(friend.friendsSince)} 成为好友</span>
                        </div>
                    )}
                </div>

                {/* 操作 */}
                <div className="flex items-center gap-2">
                    {onRemove && (
                        <Button
                            icon={<UserMinus className="w-4 h-4" />}
                            rounded
                            text
                            className="!w-9 !h-9 text-surface-400 hover:text-red-500 hover:bg-red-50 active:scale-[0.98] transition-all"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove(friend.userId);
                            }}
                            aria-label="删除好友"
                        />
                    )}
                    <Button
                        icon={<ChevronRight className="w-4 h-4" />}
                        rounded
                        text
                        className="!w-9 !h-9 text-surface-300 hover:text-surface-600 hover:bg-surface-100 active:scale-[0.98] transition-all"
                        onClick={() => router.push(`/user/${friend.userId}`)}
                        aria-label="查看主页"
                    />
                </div>
            </div>
        </div>
    );
};
