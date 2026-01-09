import React from 'react';
import { User, Activity, Target, Layers } from 'lucide-react';
import { UserProfilesRow } from '@/types';

interface PersonalInfoDisplayProps {
    profile: UserProfilesRow | null;
    phone?: string;
}

// 辅助函数保持逻辑不变
const getGenderDisplay = (gender: string | null) => {
    if (!gender) return '未填写';
    const map: Record<string, string> = { 'male': '男', 'female': '女' };
    return map[gender] || gender;
};

const getFitnessLevelDisplay = (level: string | null) => {
    if (!level) return '未填写';
    const map: Record<string, string> = {
        'beginner': '初学者',
        'intermediate': '中级',
        'advanced': '高级'
    };
    return map[level] || level;
};

/**
 * Aero 规范下的 InfoItem：数值中心化
 */
const MetricItem = ({ label, value, unit }: { label: string, value: string | number | null, unit?: string }) => (
    <div className="p-4 bg-surface-50/40 rounded-[20px] border border-surface-100/50 transition-all hover:bg-surface-50">
        <div className="text-[10px] font-black text-surface-400 tracking-widest uppercase mb-1">{label}</div>
        <div className="flex items-baseline gap-0.5">
            <span className="text-xl font-black text-surface-900 tracking-tighter">
                {value || '--'}
            </span>
            {value && unit && <span className="text-[10px] font-bold text-surface-400 ml-0.5">{unit}</span>}
        </div>
    </div>
);

/**
 * 轻量化文字条目
 */
const TextItem = ({ label, value, icon: Icon }: { label: string, value: string | null, icon: any }) => (
    <div className="flex items-start gap-3 p-2 group">
        <div className="w-8 h-8 rounded-full bg-surface-50 flex items-center justify-center text-surface-400 group-hover:bg-primary-50 group-hover:text-primary-500 transition-colors">
            <Icon size={14} strokeWidth={2.5} />
        </div>
        <div className="flex flex-col">
            <span className="text-[10px] font-bold text-surface-400 tracking-tight uppercase">{label}</span>
            <span className="text-sm font-bold text-surface-800 tracking-tight leading-snug">
                {value || '未填写'}
            </span>
        </div>
    </div>
);

export const PersonalInfo: React.FC<PersonalInfoDisplayProps> = ({ profile, phone }) => {
    return (
        <div className="space-y-6">
            {/* 标题部分 - 极简排版 */}
            <div className="flex items-center gap-2 px-1">
                <User size={18} className="text-primary-500" strokeWidth={2.5} />
                <h3 className="text-sm font-bold tracking-tight text-surface-900">
                    个人档案数据
                </h3>
                <div className="h-px flex-1 bg-surface-100/60 ml-2" />
            </div>

            {/* 第一组：核心体征数据 - 数值中心化 (Aero 规范核心) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricItem label="年龄" value={profile?.age} unit="Yrs" />
                <MetricItem label="性别" value={getGenderDisplay(profile?.gender || null)} />
                <MetricItem label="身高" value={profile?.height} unit="cm" />
                <MetricItem label="体重" value={profile?.weight} unit="kg" />
            </div>

            {/* 第二组：软性信息 - 模块化网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 bg-surface-50/20 rounded-[24px] p-4 border border-surface-100/30">
                <TextItem 
                    icon={User} 
                    label="昵称 / 联系方式" 
                    value={profile?.nickname || phone || '-'} 
                />
                <TextItem 
                    icon={Target} 
                    label="健身目标" 
                    value={profile?.fitness_goal || null} 
                />
                <TextItem 
                    icon={Activity} 
                    label="健身水平" 
                    value={getFitnessLevelDisplay(profile?.fitness_level || null)} 
                />
                <TextItem 
                    icon={Layers} 
                    label="生活作息" 
                    value={profile?.lifestyle || null} 
                />
            </div>
        </div>
    );
};