import React from 'react';
import { Crown, Users } from 'lucide-react'; // 建议增加一个验证图标提升质感
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
            case 'premium': return 'from-[#F28631] to-[#FFAC6B]'; // 使用你之前的橙色品牌色
            case 'advanced': return 'from-purple-500 to-indigo-500';
            default: return 'from-surface-400 to-surface-500';
        }
    };

    return (
        <div className="bg-surface rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4 sm:p-8 mb-4 sm:mb-6 relative overflow-hidden border border-surface-100">
            {/* 1. 优化背景装饰：移动端增加弧度感 */}
            <div className={`absolute top-0 left-0 w-full h-16 sm:h-32 bg-gradient-to-r ${getLevelColor(subscriptionLevel)} opacity-90`} 
                 style={{ clipPath: 'ellipse(100% 100% at 50% 0%)' }} />
            
            <div className="relative flex items-end gap-4 sm:flex-col sm:items-center sm:text-center">
                {/* 2. 头像：移动端略微上移，产生层级感 */}
                <div className={`w-20 h-20 sm:w-32 sm:h-32 rounded-full bg-surface p-1 shadow-xl shrink-0 -mt-2 sm:mt-0`}>
                    <div className={`w-full h-full rounded-full bg-gradient-to-br ${getLevelColor(subscriptionLevel)} p-1`}>
                        <div className="w-full h-full rounded-full bg-surface-50 flex items-center justify-center overflow-hidden border-2 border-surface">
                            {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt={profile.nickname || 'User'} className="w-full h-full object-cover" />
                            ) : (
                                <span className={`text-2xl sm:text-4xl font-black bg-clip-text text-transparent bg-gradient-to-br ${getLevelColor(subscriptionLevel)}`}>
                                    {(profile?.nickname || user.phone || 'U').charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. 文本区：紧凑排版 */}
                <div className="min-w-0 flex-1 pb-1 sm:pb-0 sm:flex-none">
                    <div className="flex items-center gap-2 sm:justify-center">
                        <h1 className="text-xl sm:text-3xl font-black text-surface-900 leading-none truncate tracking-tight px-2">
                            {profile?.nickname || `用户 ${user.phone?.slice(-4)}`}
                        </h1>
                        {subscriptionLevel === 'premium' && (
                            <div className="bg-orange-100 text-orange-600 rounded-full p-0.5">
                                <Crown size={14} fill="currentColor" />
                            </div>
                        )}
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2 sm:justify-center">
                        {/* 身份标签 */}
                        <div className="px-2.5 py-1 rounded-lg bg-surface-100 text-surface-600 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                            <Users size={12} strokeWidth={3} />
                            学员
                        </div>
                        
                        {/* 等级标签：增加玻璃拟态效果 */}
                        <div className={`px-2.5 py-1 rounded-lg text-surface text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm bg-gradient-to-r ${getLevelColor(subscriptionLevel)}`}>
                            <Crown size={12} strokeWidth={3} />
                            {getLevelLabel(subscriptionLevel)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};