import React, { useState, useEffect } from 'react';
import { User, Edit, Dumbbell, Activity, Bike, Footprints } from 'lucide-react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Skeleton } from 'primereact/skeleton';
import { ProgressBar } from 'primereact/progressbar';
import { ProfileData } from './types';
import { studentService } from '@/app/service/studentService';
import { useToastContext } from '@/context/ToastContext';
import { SportCards } from '@/types/sportCards';
import { AeroInputNumber } from '@/components/AeroInputNumber';
import { AeroTimePicker } from '@/components/AeroTimePicker';
import { getEmptySportCards, getTotalWeight, showTotalWeight, SportTypes, typicalActionMaps } from '@/lib/sportsCollections';

interface PersonalInfoSectionProps {
    data: ProfileData;
    onUpdate: () => void;
    editingVisible?: boolean;
    onEditingChange?: (visible: boolean) => void;
    hideDisplay?: boolean;
}

// 性别选项
const GENDER_OPTIONS = [
    { label: '男', value: 'male' },
    { label: '女', value: 'female' },
];

// 健身目标选项
const FITNESS_GOAL_OPTIONS = [
    { label: '减脂塑形', value: '减脂' },
    { label: '增肌强身', value: '增肌' },
    { label: '力量提升', value: '力量提升' },
    { label: '体能改善', value: '体能改善' },
];

// 健身水平选项
const FITNESS_LEVEL_OPTIONS = [
    { label: '零基础', value: 'beginner' },
    { label: '入门', value: 'novice' },
    { label: '进阶', value: 'intermediate' },
    { label: '高阶', value: 'advanced' },
    { label: '精英 / 职业', value: 'elite' },
];

// 辅助函数：转换健身水平显示
const getFitnessLevelDisplay = (level: string | null) => {
    if (!level) return '未填写';
    const map: Record<string, string> = {
        'beginner': '零基础',
        'novice': '入门',
        'intermediate': '进阶',
        'advanced': '高阶',
        'elite': '精英 / 职业'
    };
    return map[level] || level;
};

export const PersonalInfoSection: React.FC<PersonalInfoSectionProps> = ({ 
    data, 
    onUpdate, 
    editingVisible,
    onEditingChange,
    hideDisplay = false
}) => {
    const { profile } = data;
    const [isEditing, setIsEditing] = useState(false);
    
    // 如果外部控制可见性，使用外部状态
    const editingState = editingVisible !== undefined ? editingVisible : isEditing;
    const setEditingState = (visible: boolean) => {
        if (onEditingChange) {
            onEditingChange(visible);
        } else {
            setIsEditing(visible);
        }
    };
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [step, setStep] = useState(1);
    const { showToast } = useToastContext();

    // Form state
    const [formData, setFormData] = useState({
        nickname: '',
        avatar_url: '',
        age: null as number | null,
        gender: '',
        height: null as number | null,
        weight: null as number | null,
        lifestyle: '',
        fitness_goal: '',
        fitness_level: '',
        sport_cards: getEmptySportCards()
    });

    // 初始化表单数据
    const initFormData = () => {
        const sportCards = (profile?.sport_cards as unknown as SportCards) || getEmptySportCards();

        setFormData({
            nickname: profile?.nickname || '',
            avatar_url: profile?.avatar_url || '',
            age: profile?.age || null,
            gender: profile?.gender || '',
            height: profile?.height || null,
            weight: profile?.weight || null,
            lifestyle: profile?.lifestyle || '',
            fitness_goal: profile?.fitness_goal || '',
            fitness_level: profile?.fitness_level || '',
            sport_cards: {
                ...getEmptySportCards(),
                ...sportCards
            }
        });
    };

    // 当编辑对话框打开时，自动初始化表单数据
    useEffect(() => {
        if (editingState && profile) {
            const sportCards = (profile?.sport_cards as unknown as SportCards) || getEmptySportCards();
            
            setFormData({
                nickname: profile?.nickname || '',
                avatar_url: profile?.avatar_url || '',
                age: profile?.age || null,
                gender: profile?.gender || '',
                height: profile?.height || null,
                weight: profile?.weight || null,
                lifestyle: profile?.lifestyle || '',
                fitness_goal: profile?.fitness_goal || '',
                fitness_level: profile?.fitness_level || '',
                sport_cards: {
                    ...getEmptySportCards(),
                    ...sportCards
                }
            });
            setStep(1); // 重置到第一步
        }
    }, [editingState, profile]);

    const handleSave = async () => {
        try {
            setLoading(true);
            await studentService.updateProfile({
                nickname: formData.nickname,
                avatar_url: formData.avatar_url || null,
                age: formData.age,
                gender: formData.gender,
                height: formData.height,
                weight: formData.weight,
                lifestyle: formData.lifestyle,
                fitness_goal: formData.fitness_goal,
                fitness_level: formData.fitness_level,
                sport_cards: formData.sport_cards
            });
            showToast({ severity: 'success', summary: '保存成功', detail: '个人信息已更新' });
            setEditingState(false);
            setStep(1); // Reset to first step when closing
            onUpdate();
        } catch (error) {
            showToast({ severity: 'error', summary: '保存失败', detail: '无法更新个人信息，请重试' });
        } finally {
            setLoading(false);
        }
    };

    const handleUploadAvatar = async (file?: File) => {
        if (!file) return;
        setUploading(true);
        try {
            const form = new FormData();
            form.append('file', file);
            const res = await fetch('/api/upload/avatar', { method: 'POST', body: form });
            const data = await res.json();
            if (data?.success && data?.data?.url) {
                setFormData({ ...formData, avatar_url: data.data.url });
                showToast({ severity: 'success', summary: '上传成功', detail: '头像已更新' });
            } else {
                showToast({ severity: 'error', summary: '上传失败', detail: data?.message || '请稍后再试' });
            }
        } catch (err) {
            showToast({ severity: 'error', summary: '上传失败', detail: '网络异常' });
        } finally {
            setUploading(false);
        }
    };

    // 切换卡片选择
    const toggleCard = (cardKey: string) => {
        const activeCards = formData.sport_cards.activeCards.includes(cardKey)
            ? formData.sport_cards.activeCards.filter(c => c !== cardKey)
            : [...formData.sport_cards.activeCards, cardKey];
        setFormData({
            ...formData,
            sport_cards: { ...formData.sport_cards, activeCards },
        });
    };

    // 更新卡片数据 (数字类型)
    const updateCardData = (cardKey: string, field: string, value: number | null) => {
        setFormData({
            ...formData,
            sport_cards: {
                ...formData.sport_cards,
                [cardKey]: {
                    ...(formData.sport_cards[cardKey as keyof SportCards] as object),
                    [field]: value,
                },
            },
        });
    };

    // 处理下一步
    const handleNext = () => {
        if (step < 3) {
            setStep(step + 1);
        }
    };

    // 处理上一步
    const handleBack = () => {
        if (step > 1) {
            setStep(step - 1);
        }
    };

    const InfoItem = ({ label, value }: { label: string, value: string | number | null }) => (
        <div className="px-2.5 py-1.5 bg-surface-50 rounded-xl border border-surface-200 text-xs">
            <span className="text-[11px] font-bold text-surface-500">{label}</span>
            <span className="mx-1 text-surface-300">·</span>
            <span className="font-black text-surface-900">{value || '未填写'}</span>
        </div>
    );

    const InfoItemSkeleton = () => (
        <div className="px-2.5 py-1.5 bg-surface-50 rounded-xl border border-surface-200">
            <Skeleton width="120px" height="0.9rem" />
        </div>
    );

    return (
        <>
            {!hideDisplay && (
                <div className="bg-surface rounded-2xl shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm sm:text-lg font-black text-surface-900 flex items-center gap-2">
                            <User className="text-primary" size={20} />
                            个人信息
                        </h2>
                        <Button
                            aria-label="编辑资料"
                            icon={<Edit size={16} />}
                            text
                            onClick={() => {
                                initFormData();
                                setEditingState(true);
                                setStep(1); // Reset to first step when opening
                            }}
                            className="p-2 rounded-2xl"
                        />
                    </div>

                    {!profile ? (
                        <div className="flex flex-wrap gap-2">
                            {[...Array(6)].map((_, index) => (<InfoItemSkeleton key={index} />))}
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            <InfoItem label="身高" value={profile?.height ? `${profile.height} cm` : null} />
                            <InfoItem label="体重" value={profile?.weight ? `${profile.weight} kg` : null} />
                            <InfoItem label="健身目标" value={profile?.fitness_goal || null} />
                            <InfoItem label="健身水平" value={getFitnessLevelDisplay(profile?.fitness_level)} />
                            <InfoItem label="生活作息" value={profile?.lifestyle || null} />
                        </div>
                    )}
                </div>
            )}

            <Dialog
                header="编辑个人资料"
                visible={editingState}                
                style={{ width: '640px' }}
                onHide={() => {
                    setEditingState(false);
                    setStep(1);
                }}
                footer={
                    <div className="flex gap-2 pt-6 border-t border-surface-200/50">
                        {step === 1 ? (
                            <Button
                                label="取消"
                                onClick={() => setEditingState(false)}
                                className="flex-1 h-14 rounded-2xl bg-surface-50 border-none text-surface-500 font-black active:scale-95 transition-all"
                            />
                        ) : (
                            <Button
                                label="上一步"
                                icon="pi pi-arrow-left"
                                onClick={handleBack}
                                className="flex-1 h-14 rounded-2xl bg-surface-50 border-none text-surface-500 font-black active:scale-95 transition-all"
                            />
                        )}

                        {step < 3 ? (
                            <Button
                                label="下一步"
                                icon="pi pi-arrow-right"
                                onClick={handleNext}
                                className="flex-1 h-14 rounded-2xl bg-primary-500 border-none text-surface font-black active:scale-[0.98] transition-all shadow-xl shadow-primary-100"
                            />
                        ) : (
                            <Button
                                label="保存"
                                icon="pi pi-check"
                                onClick={handleSave}
                                loading={loading}
                                className="flex-1 h-14 rounded-2xl bg-primary-500 border-none text-surface font-black active:scale-[0.98] transition-all shadow-xl shadow-primary-100"
                            />
                        )}
                    </div>
                }
                pt={{
                    root: {
                        className: 'shadow-none border-none bg-transparent min-h-screen md:min-h-[fit-content]'
                    },
                    header: {
                        className: 'p-8 pb-4 border-none bg-surface md:rounded-t-[24px] rounded-t-none'
                    },
                    content: {
                        className: 'text-xl font-black tracking-tight md:overflow-y-auto md:max-h-[calc(100vh-300px)]'
                    },
                    footer: {
                        className: 'p-8 md:rounded-b-[24px] rounded-b-none'
                    }
                }}
            >
                {/* 进度导航：采用非线性平滑过渡 */}
                <div className="mb-10 px-1">
                    <div className="flex justify-between items-end mb-3">
                        <span className="text-[10px] font-black text-primary-500 uppercase tracking-[0.3em]">
                            第 {step} 步 / 共 3 步
                        </span>
                        <span className="text-sm font-black text-surface-900 tracking-tight">
                            {step === 1 ? '基本信息' : step === 2 ? '练习领域' : '历史成绩'}
                        </span>
                    </div>
                    <ProgressBar value={(step / 3) * 100} showValue={false} className="h-1.5 bg-surface-50" color="#F28631" />
                </div>

                {/* 步骤内容 */}
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* 步骤1：基本信息 */}
                    {step === 1 && (
                        <div className="grid grid-cols-2 gap-x-6 gap-y-8">
                            {/* 昵称输入：信息约束设计 */}
                            <div className="col-span-2">
                                <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest mb-2 block px-1">显示昵称</label>
                                <InputText
                                    value={formData.nickname}
                                    onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                                    className="w-full h-12 rounded-xl border-surface-200 bg-surface-50/30 focus:bg-surface transition-all font-bold"
                                    placeholder="如何称呼您？"
                                />
                            </div>

                            {/* 头像上传：视觉资产配置 */}
                            <div className="col-span-2">
                                <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest mb-2 block px-1">头像</label>
                                <div className="flex items-center gap-3">
                                    <InputText
                                        value={formData.avatar_url}
                                        onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                                        placeholder="粘贴图片URL"
                                        className="flex-1 h-12 rounded-xl border-surface-200 bg-surface-50/30 focus:bg-surface transition-all font-bold"
                                    />
                                    {formData.avatar_url ? (
                                        <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-100 border">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={formData.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                                        </div>
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-surface-100 border flex items-center justify-center text-surface-400 text-xs">无</div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <label className="px-3 py-2 border border-surface-200 rounded-lg text-sm cursor-pointer hover:bg-surface-50">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleUploadAvatar(file);
                                            }}
                                        />
                                        选择本地图片
                                    </label>
                                    <Button label="清空" text size="small" onClick={() => setFormData({ ...formData, avatar_url: '' })} type="button" />
                                    {uploading && <span className="text-xs text-surface-500">上传中...</span>}
                                </div>
                                <p className="text-xs text-surface-500 mt-1">支持 PNG/JPG/WEBP，≤2MB。</p>
                            </div>

                            {/* 年龄输入：精确数据维度 */}
                            <div>
                                <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest mb-2 block px-1">年龄</label>
                                <AeroInputNumber
                                    value={formData.age}
                                    onValueChange={(e) => setFormData({ ...formData, age: e.value ?? null })}
                                    min={10}
                                    max={100}
                                    suffix=" 岁"
                                    inputClassName="w-full h-12 rounded-xl border-surface-200 bg-surface-50/30 focus:bg-surface transition-all font-bold"
                                />
                            </div>

                            {/* 生理性别：低饱和功能色下拉框 */}
                            <div>
                                <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest mb-2 block px-1">性别</label>
                                <Dropdown
                                    value={formData.gender}
                                    options={GENDER_OPTIONS}
                                    onChange={(e) => setFormData({ ...formData, gender: e.value })}
                                    className="w-full h-12 rounded-xl border-surface-200 bg-surface-50/30 font-bold"
                                    placeholder="请选择"
                                />
                            </div>

                            {/* 身高输入：精确数据维度 */}
                            <div>
                                <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest mb-2 block px-1">身高 (cm)</label>
                                <AeroInputNumber
                                    value={formData.height}
                                    onValueChange={(e) => setFormData({ ...formData, height: e.value ?? null })}
                                    min={100}
                                    max={250}
                                    inputClassName="w-full h-12 rounded-xl border-surface-200 bg-surface-50/30 focus:bg-surface transition-all font-bold"
                                />
                            </div>

                            {/* 体重输入：精确数据维度 */}
                            <div>
                                <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest mb-2 block px-1">体重 (kg)</label>
                                <AeroInputNumber
                                    value={formData.weight}
                                    onValueChange={(e) => setFormData({ ...formData, weight: e.value ?? null })}
                                    min={30}
                                    max={300}
                                    mode="decimal"
                                    minFractionDigits={1}
                                    inputClassName="w-full h-12 rounded-xl border-surface-200 bg-surface-50/30 focus:bg-surface transition-all font-bold"
                                />
                            </div>

                            {/* 健身目标：低饱和功能色下拉框 */}
                            <div>
                                <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest mb-2 block px-1">健身目标</label>
                                <Dropdown
                                    value={formData.fitness_goal}
                                    options={FITNESS_GOAL_OPTIONS}
                                    onChange={(e) => setFormData({ ...formData, fitness_goal: e.value })}
                                    className="w-full h-12 rounded-xl border-surface-200 bg-surface-50/30 font-bold"
                                    placeholder="请选择"
                                />
                            </div>

                            {/* 当前水平：低饱和功能色下拉框 */}
                            <div>
                                <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest mb-2 block px-1">当前水平</label>
                                <Dropdown
                                    value={formData.fitness_level}
                                    options={FITNESS_LEVEL_OPTIONS}
                                    onChange={(e) => setFormData({ ...formData, fitness_level: e.value })}
                                    className="w-full h-12 rounded-xl border-surface-200 bg-surface-50/30 font-bold"
                                    placeholder="请选择"
                                />
                            </div>

                            {/* 生活作息 */}
                            <div>
                                <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest mb-2 block px-1">生活作息</label>
                                <InputText
                                    value={formData.lifestyle}
                                    onChange={(e) => setFormData({ ...formData, lifestyle: e.target.value })}
                                    placeholder="如：朝九晚五"
                                    className="w-full h-12 rounded-xl border-surface-200 bg-surface-50/30 focus:bg-surface transition-all font-bold"
                                />
                            </div>
                        </div>
                    )}

                    {/* 步骤2：身体数据 */}
                    {step === 2 && (
                        <div className='space-y-8 animate-in fade-in slide-in-from-right-4 duration-500'>
                            <div className='text-xl'>选择您感兴趣或正在练习的领域</div>
                            <div className='grid grid-cols-2 gap-3'>
                                {SportTypes.map((sport) => {
                                    const Icon = sport.icon;
                                    const isActive = formData.sport_cards.activeCards.includes(sport.key);
                                    return (
                                        <div
                                            key={sport.key}
                                            onClick={() => toggleCard(sport.key)}
                                            className={`
                                                group cursor-pointer relative overflow-hidden transition-all duration-300
                                                px-2 py-3 rounded-[16px] border text-center active:scale-[0.94]
                                                ${isActive
                                                    ? `${sport.active} shadow-sm shadow-current/5`
                                                    : 'border-surface-200 bg-surface-50/50 hover:bg-surface hover:border-surface-200'
                                                }
                                    `}
                                        >
                                            {/* 状态指示：改为更加细腻的右上角呼吸点 */}
                                            {isActive && (
                                                <div className="absolute top-2 right-2 flex items-center justify-center">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style={{ color: sport.color }} />
                                                </div>
                                            )}

                                            <div className="flex flex-col items-center gap-2">
                                                {/* 图标容器：缩小尺寸，强化背景色对比 */}
                                                <div className={`
                                                    w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 
                                                    group-hover:scale-110 group-active:rotate-12
                                                    ${sport.bg} ${sport.color}
                                                `}>
                                                    <Icon size={20} strokeWidth={2.5} />
                                                </div>

                                                <span className="text-[10px] font-black text-surface-700 tracking-tighter leading-none">
                                                    {sport.label}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 步骤3：生活方式与运动资产 */}
                    {step === 3 && (
                        <div
                            className="overflow-y-auto pr-2 space-y-3 py-2"
                        >
                            {/* 动态表单容器：修复颜色变量与渲染逻辑 */}
                            {formData.sport_cards.activeCards.map((cardKey) => {
                                const config = SportTypes.find(c => c.key === cardKey);
                                if (!config) return null;

                                const Icon = config.icon;
                                const cardData = (formData.sport_cards as any)[cardKey];

                                return (
                                    <div
                                        key={cardKey}
                                        className={`p-5 rounded-[24px] border border-opacity-40 space-y-4 animate-in zoom-in-95 slide-in-from-top-2 duration-300 ${config.bg} ${config.border}`}
                                    >
                                        {/* 头部：标题与数值展示 */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${config.color} shadow-sm`}>
                                                    <Icon size={20} strokeWidth={2.5} />
                                                </div>
                                                <h4 className={`text-xs font-black tracking-tight`}>
                                                    {config.label}
                                                </h4>
                                            </div>

                                            {/* 力量/举重/街力 特有总和展示 */}
                                            {showTotalWeight(cardKey) && (
                                                <div className="px-3 py-1 rounded-full bg-surface-900 text-surface text-[10px] font-black italic shadow-md">
                                                    总计 : {getTotalWeight(cardKey, cardData)} KG
                                                </div>
                                            )}
                                        </div>

                                        {/* 紧凑型输入网格 */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            {Object.keys(cardData || {}).map((field) => {
                                                const fieldConfig = typicalActionMaps[field];
                                                const isTimeField = fieldConfig?.unit === 'sec';

                                                return (
                                                    <div key={field}>
                                                        <label className="text-[9px] font-black text-surface-400 uppercase tracking-widest mb-1.5 block px-1">
                                                            {fieldConfig?.nameCn || field}
                                                        </label>
                                                        {isTimeField ? (
                                                            <AeroTimePicker
                                                                value={cardData[field] || 0}
                                                                onValueChange={(e) => updateCardData(cardKey as any, field, e.value)}
                                                                className="w-full sm:w-32"
                                                                inputClassName="h-10 rounded-xl border-none bg-surface font-black text-center text-xs shadow-[0_2px_8px_rgba(0,0,0,0.02)] focus:ring-2 focus:ring-orange-500/20 transition-all"
                                                            />
                                                        ) : (
                                                            <AeroInputNumber
                                                                value={cardData[field]}
                                                                onValueChange={(e) => updateCardData(cardKey as any, field, e.value ?? null)}
                                                                inputClassName="w-full sm:w-32 h-10 rounded-xl border-none bg-surface font-black text-center text-xs shadow-[0_2px_8px_rgba(0,0,0,0.02)] focus:ring-2 focus:ring-orange-500/20 transition-all"
                                                                placeholder="0"
                                                                suffix={fieldConfig.unit}
                                                            />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* 空状态提示 */}
                            {formData.sport_cards.activeCards.length === 0 && (
                                <div className="py-20 text-center rounded-[24px] border-2 border-dashed border-surface-100 bg-surface-50/20">
                                    <div className="w-12 h-12 bg-surface rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 border border-surface-50">
                                        <Activity className="w-6 h-6 text-surface-200" />
                                    </div>
                                    <p className="text-[10px] font-black text-surface-400 tracking-[0.3em] uppercase">
                                        点击上方磁贴以激活资产配置
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Dialog>
        </>
    );
};