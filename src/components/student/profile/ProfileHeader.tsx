import React from 'react';
import { Crown, Users, Activity, Clock } from 'lucide-react';
import { ProfileHeaderProps } from './types';

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ data }) => {
    const { user, profile, stats, subscriptionLevel } = data;
    
    const getLevelLabel = (level: string) => {
        switch(level) {
            case 'premium': return '至尊会员';
            case 'advanced': return '高级会员';
            default: return '基础会员';
        }
    };

    const getLevelColor = (level: string) => {
        switch(level) {
            case 'premium': return 'from-purple-500 to-indigo-600';
            case 'advanced': return 'from-blue-500 to-cyan-500';
            default: return 'from-gray-500 to-gray-600';
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-6 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-indigo-50 to-purple-50 opacity-50" />
            
            <div className="relative flex flex-col items-center text-center">
                {/* Avatar */}
                <div className={`w-32 h-32 rounded-full bg-gradient-to-br ${getLevelColor(subscriptionLevel)} p-1 shadow-lg mb-4`}>
                    <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
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
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    {profile?.nickname || `用户 ${user.phone?.slice(-4)}`}
                </h1>
                
                <div className="flex items-center gap-2 mb-6">
                    <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-medium flex items-center gap-1">
                        <Users size={14} />
                        学员
                    </span>
                    <span className={`px-3 py-1 rounded-full text-white text-sm font-medium flex items-center gap-1 bg-gradient-to-r ${getLevelColor(subscriptionLevel)}`}>
                        <Crown size={14} />
                        {getLevelLabel(subscriptionLevel)}
                    </span>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl">
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-center hover:shadow-md transition-shadow">
                        <div className="text-gray-400 mb-1"><Users size={20} /></div>
                        <div className="text-2xl font-bold text-gray-900">{stats.subscriptionCount}</div>
                        <div className="text-xs text-gray-500">订阅教练</div>
                    </div>
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-center hover:shadow-md transition-shadow">
                        <div className="text-gray-400 mb-1"><Activity size={20} /></div>
                        <div className="text-2xl font-bold text-gray-900">{stats.activePlanCount}</div>
                        <div className="text-xs text-gray-500">进行中计划</div>
                    </div>
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-center hover:shadow-md transition-shadow">
                        <div className="text-gray-400 mb-1"><Crown size={20} /></div>
                        <div className="text-2xl font-bold text-gray-900">{stats.completedWorkouts}</div>
                        <div className="text-xs text-gray-500">完成训练</div>
                    </div>
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-center hover:shadow-md transition-shadow">
                        <div className="text-gray-400 mb-1"><Clock size={20} /></div>
                        <div className="text-2xl font-bold text-gray-900">{Math.round(stats.totalTrainingTime / 60)}</div>
                        <div className="text-xs text-gray-500">训练小时</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
