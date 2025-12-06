import React from 'react';
import { Crown, Users } from 'lucide-react';
import { ProfileHeaderProps } from './types';

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ data }) => {
    const { user, profile, subscriptionLevel } = data;
    
    const getLevelLabel = (level: string) => {
        switch(level) {
            case 'premium': return '至尊会员';
            case 'advanced': return '高级会员';
            default: return '基础会员';
        }
    };

    const getLevelColor = (level: string) => {
        switch(level) {
            case 'premium': return 'from-purple-500 to-primary';
            case 'advanced': return 'from-blue-500 to-cyan-500';
            default: return 'from-surface-500 to-surface-600';
        }
    };

    return (
        <div className="bg-surface-50 rounded-2xl shadow-sm p-8 mb-6 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-primary-600 to-red-600" />
            
            <div className="relative flex flex-col items-center text-center">
                {/* Avatar */}
                <div className={`w-32 h-32 rounded-full bg-gradient-to-br ${getLevelColor(subscriptionLevel)} p-1 shadow-lg mb-4`}>
                    <div className="w-full h-full rounded-full bg-surface-200 flex items-center justify-center overflow-hidden">
                        {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt={profile.nickname || 'User'} className="w-full h-full object-cover" />
                        ) : (
                            <span className={`text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-br ${getLevelColor(subscriptionLevel)}`}>
                                {(profile?.nickname || user.phone || 'U').charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                </div>

                {/* Name & Level */}
                <h1 className="text-2xl font-bold text-surface-900 mb-2">
                    {profile?.nickname || `用户 ${user.phone?.slice(-4)}`}
                </h1>
                
                <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-primary-50 text-primary text-sm font-medium flex items-center gap-1">
                        <Users size={14} />
                        学员
                    </span>
                    <span className={`px-3 py-1 rounded-full text-surface-50 text-sm font-medium flex items-center gap-1 bg-gradient-to-r ${getLevelColor(subscriptionLevel)}`}>
                        <Crown size={14} />
                        {getLevelLabel(subscriptionLevel)}
                    </span>
                </div>
            </div>
        </div>
    );
};
