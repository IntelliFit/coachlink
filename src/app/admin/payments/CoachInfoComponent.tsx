import React from 'react';
import { Avatar } from 'primereact/avatar';
import type { GetUserProfileResponseDto } from '@/app/api/user/get-profile/entity';

interface CoachInfoComponentProps {
    profile?: GetUserProfileResponseDto['profile'] | null;
}

export const CoachInfoComponent: React.FC<CoachInfoComponentProps> = ({ profile }) => {
    return (
        <div className="flex items-center space-x-3">
            <Avatar
                image={profile?.avatar_url || undefined}
                label={
                    profile?.avatar_url
                        ? undefined
                        : profile?.nickname?.charAt(0) ||
                        profile?.full_name?.charAt(0) ||
                        'C'
                }
                shape="circle"
                className="bg-green-500 text-surface font-bold flex-shrink-0"
                size="normal"
            />
            <div>
                <div className="font-medium">
                    {profile?.nickname || profile?.full_name || '未知教练'}
                </div>
            </div>
        </div>
    );
};