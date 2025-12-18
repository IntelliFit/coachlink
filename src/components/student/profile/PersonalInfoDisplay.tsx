import React from 'react';
import { User } from 'lucide-react';
import { UserProfilesRow } from '@/types';

interface PersonalInfoDisplayProps {
    profile: UserProfilesRow | null;
    phone?: string;
}

// 辅助函数：转换性别显示
const getGenderDisplay = (gender: string | null) => {
    if (!gender) return '未填写';
    if (gender === 'male') return '男';
    if (gender === 'female') return '女';
    return gender;
};

// 辅助函数：转换健身水平显示
const getFitnessLevelDisplay = (level: string | null) => {
    if (!level) return '未填写';
    const map: Record<string, string> = {
        'beginner': '初学者',
        'intermediate': '中级',
        'advanced': '高级'
    };
    return map[level] || level;
};

const InfoItem = ({ label, value }: { label: string, value: string | number | null }) => (
    <div className="p-3 bg-surface-50 rounded-lg border border-surface-100">
        <div className="text-xs text-surface-500 mb-1">{label}</div>
        <div className="text-sm font-semibold text-surface-900">{value || '未填写'}</div>
    </div>
);

/**
 * 只读的个人信息展示组件
 * 用于教练端查看学员档案，不包含编辑功能
 */
export const PersonalInfoDisplay: React.FC<PersonalInfoDisplayProps> = ({ profile, phone }) => {
    return (
        <div className="bg-surface rounded-2xl shadow-sm overflow-hidden border border-surface-200 mb-4">
            <div className="px-5 py-3 border-b border-surface-200">
                <h3 className="text-base font-bold flex items-center gap-2 text-surface-900">
                    <User className="w-5 h-5 text-primary" />
                    个人信息
                </h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-5">
                <InfoItem label="昵称" value={profile?.nickname || phone || '-'} />
                <InfoItem label="年龄" value={profile?.age ? `${profile.age}岁` : null} />
                <InfoItem label="性别" value={getGenderDisplay(profile?.gender)} />
                <InfoItem label="身高" value={profile?.height ? `${profile.height} cm` : null} />
                <InfoItem label="体重" value={profile?.weight ? `${profile.weight} kg` : null} />
                <InfoItem label="健身目标" value={profile?.fitness_goal || null} />
                <InfoItem label="健身水平" value={getFitnessLevelDisplay(profile?.fitness_level)} />
                <InfoItem label="生活作息" value={profile?.lifestyle || null} />
            </div>
        </div>
    );
};
