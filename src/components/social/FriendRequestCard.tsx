import React from 'react';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { Check, X } from 'lucide-react';

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
    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-primary-100 flex items-center justify-between mb-3 relative overflow-hidden">
            {/* New badge */}
            <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white -mr-1 -mt-1"></div>

            <div className="flex items-center gap-3">
                <Avatar 
                    image={request.requester.avatarUrl} 
                    label={!request.requester.avatarUrl ? request.requester.nickname?.[0]?.toUpperCase() : undefined}
                    shape="circle" 
                    size="large"
                    className="bg-primary-100 text-primary-600"
                />
                <div>
                    <h3 className="font-bold text-surface-900">{request.requester.nickname}</h3>
                    <p className="text-xs text-surface-500">请求添加你为好友</p>
                </div>
            </div>
            
            <div className="flex gap-2">
                <Button 
                    icon={<Check className="w-4 h-4" />} 
                    rounded 
                    severity="success"
                    onClick={() => onAccept(request.friendshipId)}
                    disabled={loading}
                    className="w-10 h-10"
                />
                <Button 
                    icon={<X className="w-4 h-4" />} 
                    rounded 
                    severity="secondary" 
                    text
                    onClick={() => onReject(request.friendshipId)}
                    disabled={loading}
                    className="w-10 h-10"
                />
            </div>
        </div>
    );
};
