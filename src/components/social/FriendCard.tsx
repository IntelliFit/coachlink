import React from 'react';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { UserMinus, User } from 'lucide-react';
import { useRouter } from 'next/navigation';

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

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-surface-100 flex items-center justify-between mb-3">
            <div 
                className="flex items-center gap-3 flex-1 cursor-pointer"
                onClick={() => router.push(`/user/${friend.userId}`)}
            >
                <Avatar 
                    image={friend.avatarUrl} 
                    label={!friend.avatarUrl ? friend.nickname?.[0]?.toUpperCase() : undefined}
                    shape="circle" 
                    size="large"
                    className="bg-primary-100 text-primary-600"
                />
                <div>
                    <h3 className="font-bold text-surface-900">{friend.nickname}</h3>
                    {friend.friendsSince && (
                        <p className="text-xs text-surface-500">
                            好友 Since {new Date(friend.friendsSince).toLocaleDateString()}
                        </p>
                    )}
                </div>
            </div>
            
            <div className="flex gap-2">
                <Button 
                    icon={<User className="w-4 h-4" />} 
                    rounded 
                    text 
                    severity="secondary"
                    onClick={() => router.push(`/user/${friend.userId}`)}
                    aria-label="查看主页"
                />
                {onRemove && (
                    <Button 
                        icon={<UserMinus className="w-4 h-4" />} 
                        rounded 
                        text 
                        severity="danger"
                        onClick={() => onRemove(friend.userId)}
                        aria-label="删除好友"
                    />
                )}
            </div>
        </div>
    );
};
