import React, { useState, useRef } from 'react';
import { Crown, Users, Edit, Mars, Venus, Ruler, Weight, Target, Activity, MoreVertical } from 'lucide-react';
import { Button } from 'primereact/button';
import { Menu } from 'primereact/menu';
import { ProfileHeaderProps } from './types';
import { friendService } from '@/app/service/friendService';
import { useToastContext } from '@/context/ToastContext';
import { useSession } from 'next-auth/react';

// 辅助函数：转换健身水平显示
const getFitnessLevelDisplay = (level: string | null) => {
    if (!level) return null;
    const map: Record<string, string> = {
        'beginner': '初学者',
        'intermediate': '中级',
        'advanced': '高级'
    };
    return map[level] || level;
};

interface ProfileHeaderMergedProps extends ProfileHeaderProps {
    onUpdate: () => void;
    onEditClick?: () => void;
}

export const ProfileHeaderMerged: React.FC<ProfileHeaderMergedProps> = ({ data, onUpdate, onEditClick }) => {
    const { user, profile, subscriptionLevel } = data;
    const { showToast } = useToastContext();
    const { data: session } = useSession();
    const menuRef = useRef<Menu>(null);
    const [addingFriend, setAddingFriend] = useState(false);
    
    const getLevelLabel = (level: string) => {
        switch(level) {
            case 'premium': return '至尊会员';
            case 'advanced': return '高级会员';
            default: return '基础会员';
        }
    };

    const getLevelColor = (level: string) => {
        switch(level) {
            case 'premium': return 'from-[#F28631] to-[#FFAC6B]';
            case 'advanced': return 'from-purple-500 to-indigo-500';
            default: return 'from-surface-400 to-surface-500';
        }
    };

    // --- 核心优化：构建带图标的标签数据结构 ---
    const infoTags = [];
    
    // 性别图标处理
    if (profile?.gender === 'male') {
        infoTags.push({ icon: <Mars size={12} className="text-blue-500" />, label: '男', className: 'bg-blue-50/50 border-blue-100' });
    } else if (profile?.gender === 'female') {
        infoTags.push({ icon: <Venus size={12} className="text-pink-500" />, label: '女', className: 'bg-pink-50/50 border-pink-100' });
    }

    // if (profile?.age) infoTags.push({ label: `${profile.age}岁` });
    // if (profile?.height) infoTags.push({ label: `${profile.height}cm` });
    // if (profile?.weight) infoTags.push({ label: `${profile.weight}kg` });
    if (profile?.fitness_goal) infoTags.push({ label: profile.fitness_goal });
    
    const fitnessLevel = getFitnessLevelDisplay(profile?.fitness_level);
    if (fitnessLevel) infoTags.push({ icon: <Activity size={12} />, label: fitnessLevel });

    // 处理添加好友
    const handleAddFriend = async () => {
        if (!session?.user?.id || !user?.id) {
            showToast({ severity: 'error', summary: '无法添加好友', detail: '用户信息不完整' });
            return;
        }

        // 不能添加自己为好友
        if (session.user.id === user.id) {
            showToast({ severity: 'info', summary: '提示', detail: '不能添加自己为好友' });
            return;
        }

        try {
            setAddingFriend(true);
            const result = await friendService.sendRequest(user.id);
            
            if (result.success) {
                if (result.data?.status === 'already_requested') {
                    showToast({ severity: 'info', summary: '已发送过请求', detail: result.message || '请等待对方通过' });
                } else if (result.data?.status === 'accepted') {
                    showToast({ severity: 'success', summary: '添加成功', detail: result.message || '已自动成为好友' });
                } else {
                    showToast({ severity: 'success', summary: '请求已发送', detail: result.message || '等待对方通过' });
                }
            } else {
                showToast({ severity: 'error', summary: '添加失败', detail: result.message || '请稍后重试' });
            }
        } catch (error) {
            console.error('Add friend error:', error);
            showToast({ severity: 'error', summary: '添加失败', detail: '网络错误，请稍后重试' });
        } finally {
            setAddingFriend(false);
        }
    };

    // 菜单项
    const menuItems = [
        {
            label: '添加好友',
            icon: 'pi pi-user-plus',
            command: handleAddFriend,
            disabled: addingFriend || !session?.user?.id || session.user.id === user.id,
        },
    ];

    return (
        <div className="rounded-3xl mb-4 sm:mb-6 overflow-hidden">
            <div className="p-2 sm:p-6">
                {/* 顶部：头像和基本信息区 */}
                <div className="flex items-start gap-4 mb-5">
                    {/* 左侧：头像 */}
                    <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 relative">
                        <div className={`w-full h-full rounded-full bg-gradient-to-br ${getLevelColor(subscriptionLevel)} p-0.5`}>
                            <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-white">
                                {profile?.avatar_url ? (
                                    <img 
                                        src={profile.avatar_url} 
                                        alt={profile.nickname || 'User'} 
                                        className="w-full h-full object-cover" 
                                    />
                                ) : (
                                    <span className={`text-2xl sm:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-br ${getLevelColor(subscriptionLevel)}`}>
                                        {(profile?.nickname || user.phone || 'U').charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 中间：用户名和详细信息 */}
                    <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-center gap-2 mb-1.5">
                            <h1 className="text-xl font-bold text-surface-900 truncate">
                                {profile?.nickname || `用户 ${user.phone?.slice(-4)}`}
                            </h1>
                            {subscriptionLevel === 'premium' && (
                                <div className="bg-orange-100 text-orange-600 rounded-full p-0.5 shrink-0">
                                    <Crown size={12} fill="currentColor" />
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="text-xs text-surface-400 font-medium">
                                ID: {user.id?.toString().slice(-8) || '-'}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="px-2 py-0.5 rounded-md bg-surface-100 text-surface-600 text-[10px] font-bold flex items-center gap-1">
                                    <Users size={10} /> 学员
                                </div>
                                <div className={`px-2 py-0.5 rounded-md text-white text-[10px] font-bold flex items-center gap-1 shadow-sm bg-gradient-to-r ${getLevelColor(subscriptionLevel)}`}>
                                    <Crown size={10} /> {getLevelLabel(subscriptionLevel)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 右侧：编辑按钮 */}
                    {onEditClick && (
                        <div className="shrink-0">
                            <Button
                                icon={<Edit size={18} className="text-surface-400" />}
                                text
                                onClick={onEditClick}
                                className="p-2 hover:bg-surface-50 rounded-full transition-colors"
                            />
                        </div>
                    )}
                </div>

                {/* 简介 */}
                {profile?.lifestyle && (
                    <p className="text-sm text-surface-600 mb-4 px-1 leading-snug">
                        {profile.lifestyle}
                    </p>
                )}

                {/* 优化后的标签区 */}
                {infoTags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mb-6 px-1">
                        {infoTags.map((tag, index) => (
                            <div 
                                key={index}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-full border border-surface-200 bg-surface-50/50 text-surface-700 text-[11px] font-medium transition-all hover:border-surface-300 ${tag.className || ''}`}
                            >
                                {tag.icon}
                                {tag.label}
                            </div>
                        ))}
                    </div>
                )}

                {/* 统计数据区 - 左对齐，右侧三点菜单 */}
                <div className="flex items-center justify-between py-4 border-t border-surface-100">
                    {/* 左侧：统计数据 */}
                    <div className="flex items-center gap-6">
                        {[
                            { label: '订阅', value: data.stats.subscriptionCount },
                            { label: '进行中', value: data.stats.activePlanCount },
                            { label: '已完成', value: data.stats.completedWorkouts }
                        ].map((stat, i) => (
                            <div key={i} className="flex flex-col items-center cursor-pointer group">
                                <div className="text-lg font-bold text-surface-900 group-hover:text-primary transition-colors">
                                    {stat.value}
                                </div>
                                <div className="text-[10px] text-surface-400 uppercase tracking-wider font-semibold">
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 右侧：三点菜单 */}
                    <div className="relative">
                        <Button
                            icon={<MoreVertical size={18} className="text-surface-400" />}
                            text
                            onClick={(e) => menuRef.current?.toggle(e)}
                            className="p-2 hover:bg-surface-50 rounded-full transition-colors"
                            aria-label="更多选项"
                        />
                        <Menu
                            ref={menuRef}
                            model={menuItems}
                            popup
                            className="min-w-[160px]"
                            pt={{
                                root: { className: 'border-none shadow-xl rounded-[20px] p-2 bg-surface/90 backdrop-blur-md' },
                                menuitem: { className: 'rounded-[12px] overflow-hidden mb-1' },
                                action: { className: 'hover:bg-surface-50 p-3 transition-all' },
                                label: { className: 'text-[13px] font-bold text-surface-700 tracking-tight' },
                                icon: { className: 'text-primary-500 mr-3 text-sm' }
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};