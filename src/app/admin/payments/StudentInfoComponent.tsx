import React from 'react';
import { Avatar } from 'primereact/avatar';
import type { GetUserProfileResponseDto } from '@/app/api/user/get-profile/entity';

interface StudentInfoComponentProps {
    profile?: GetUserProfileResponseDto['profile'] | null;
    tier?: number;
}

export const StudentInfoComponent: React.FC<StudentInfoComponentProps> = ({ profile, tier }) => {
    
    return (
        <div className="flex items-center space-x-3">
            <Avatar
                image={profile?.avatar_url || undefined}
                label={
                    profile?.avatar_url
                        ? undefined
                        : profile?.nickname?.charAt(0) ||
                        profile?.full_name?.charAt(0) ||
                        'U'
                }
                shape="circle"
                className="bg-primary text-surface font-bold flex-shrink-0"
                size="normal"
            />
            <div>
                <div className="font-medium">
                    {profile?.nickname || profile?.full_name || '未知用户'}
                </div>
                {tier !== undefined && (
                    <div className="text-sm text-surface-500">
                        订阅等级: {tier}
                    </div>
                )}
            </div>
        </div>
    );
};