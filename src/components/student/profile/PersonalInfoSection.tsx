import React, { useState } from 'react';
import { User, Edit, Dumbbell, Activity } from 'lucide-react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { Skeleton } from 'primereact/skeleton';
import { Checkbox } from 'primereact/checkbox';
import { ProfileData } from './types';
import { studentService } from '@/app/service/studentService';
import { useToastContext } from '@/context/ToastContext';

interface PersonalInfoSectionProps {
    data: ProfileData;
    onUpdate: () => void;
}

// 性别选项 - 使用英文值匹配数据库
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

// 健身水平选项 - 使用英文值匹配数据库约束
const FITNESS_LEVEL_OPTIONS = [
    { label: '初学者', value: 'beginner' },
    { label: '中级', value: 'intermediate' },
    { label: '高级', value: 'advanced' },
];

// 运动卡片类型
const CARD_TYPES = [
    { key: 'powerlifting', label: '力量举', icon: Dumbbell },
    { key: 'bodybuilding', label: '健美/形体', icon: User },
    { key: 'fitness', label: '一般体能', icon: Activity },
];

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

export const PersonalInfoSection: React.FC<PersonalInfoSectionProps> = ({ data, onUpdate }) => {
    const { user, profile } = data;
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const { showToast } = useToastContext();

    // Form state - 包含所有问卷字段
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
        sport_cards: {
            activeCards: [] as string[],
            powerlifting: { squat: null as number | null, bench: null as number | null, deadlift: null as number | null },
            bodybuilding: { chest: null as number | null, arm: null as number | null, waist: null as number | null, hip: null as number | null, bodyfat: null as number | null },
            fitness: { pullups: null as number | null, pushups: null as number | null, plank: null as number | null, restingHR: null as number | null },
        }
    });

    // 初始化表单数据
    const initFormData = () => {
        const sportCards = profile?.sport_cards as any || {
            activeCards: [],
            powerlifting: { squat: null, bench: null, deadlift: null },
            bodybuilding: { chest: null, arm: null, waist: null, hip: null, bodyfat: null },
            fitness: { pullups: null, pushups: null, plank: null, restingHR: null },
        };
        
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
            sport_cards: sportCards
        });
    };

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
            showToast({
                severity: 'success',
                summary: '保存成功',
                detail: '个人信息已更新'
            });
            setIsEditing(false);
            onUpdate();
        } catch (error) {
            showToast({
                severity: 'error',
                summary: '保存失败',
                detail: '无法更新个人信息，请重试'
            });
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

    // 更新卡片数据
    const updateCardData = (cardKey: string, field: string, value: number | null) => {
        setFormData({
            ...formData,
            sport_cards: {
                ...formData.sport_cards,
                [cardKey]: {
                    ...(formData.sport_cards[cardKey as keyof typeof formData.sport_cards] as object),
                    [field]: value,
                },
            },
        });
    };

    const InfoItem = ({ label, value }: { label: string, value: string | number | null }) => (
        <div className="p-4 bg-surface-50 rounded-xl border border-surface-100">
            <div className="text-sm text-surface-500 mb-1">{label}</div>
            <div className="text-sm font-semibold text-surface-900">{value || '未填写'}</div>
        </div>
    );

    // 渲染信息项骨架屏
    const InfoItemSkeleton = () => (
        <div className="p-4 bg-surface-50 rounded-xl border border-surface-100">
            <Skeleton width="40%" height="0.875rem" className="mb-2" />
            <Skeleton width="60%" height="1.25rem" />
        </div>
    );

    return (
        <div className="bg-surface rounded-2xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                    <User className="text-primary" size={20} />
                    个人信息
                </h2>
                <Button 
                    label="编辑资料" 
                    icon={<Edit size={16} className="mr-2" />} 
                    text 
                    onClick={() => {
                        initFormData();
                        setIsEditing(true);
                    }}
                />
            </div>

            {/* 显示加载状态的骨架屏 */}
            {!profile ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, index) => (
                        <InfoItemSkeleton key={index} />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <InfoItem label="身高" value={profile?.height ? `${profile.height} cm` : null} />
                    <InfoItem label="体重" value={profile?.weight ? `${profile.weight} kg` : null} />
                    <InfoItem label="健身目标" value={profile?.fitness_goal || null} />
                    <InfoItem label="健身水平" value={getFitnessLevelDisplay(profile?.fitness_level)} /><InfoItem label="生活作息" value={profile?.lifestyle || null} />
                </div>
            )}

            <Dialog 
                header="编辑个人资料" 
                visible={isEditing} 
                style={{ width: '90vw', maxWidth: '900px' }} 
                onHide={() => setIsEditing(false)}
                footer={
                    <div className="flex justify-end gap-2">
                        <Button label="取消" text onClick={() => setIsEditing(false)} />
                        <Button label="保存" loading={loading} onClick={handleSave} />
                    </div>
                }
            >
                <div className="flex flex-col gap-6 py-4">
                    {/* 基本信息 */}
                    <div>
                        <h3 className="text-md font-semibold mb-4 text-surface-700">基本信息</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="flex flex-col gap-2">
                                <label htmlFor="nickname" className="text-sm font-medium">昵称</label>
                                <InputText 
                                    id="nickname" 
                                    value={formData.nickname} 
                                    onChange={(e) => setFormData({...formData, nickname: e.target.value})} 
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label htmlFor="avatar" className="text-sm font-medium">头像链接</label>
                                <div className="flex items-center gap-3">
                                    <InputText 
                                        id="avatar"
                                        value={formData.avatar_url}
                                        onChange={(e) => setFormData({...formData, avatar_url: e.target.value})} 
                                        placeholder="粘贴图片URL"
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
                                <div className="flex items-center gap-2">
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
                                    <Button label="清空" text size="small" onClick={() => setFormData({ ...formData, avatar_url: '' })} />
                                    {uploading && <span className="text-xs text-surface-500">上传中...</span>}
                                </div>
                                <p className="text-xs text-surface-500">支持 PNG/JPG/WEBP，≤2MB。</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label htmlFor="age" className="text-sm font-medium">年龄</label>
                                <InputNumber 
                                    id="age" 
                                    value={formData.age} 
                                    onValueChange={(e) => setFormData({...formData, age: e.value ?? null})} 
                                    min={10} max={100}
                                    suffix=" 岁"
                                    className="w-full"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label htmlFor="gender" className="text-sm font-medium">性别</label>
                                <Dropdown 
                                    id="gender" 
                                    value={formData.gender} 
                                    options={GENDER_OPTIONS} 
                                    onChange={(e) => setFormData({...formData, gender: e.value})} 
                                    placeholder="选择性别"
                                    className="w-full"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label htmlFor="height" className="text-sm font-medium">身高 (cm)</label>
                                <InputNumber 
                                    id="height" 
                                    value={formData.height} 
                                    onValueChange={(e) => setFormData({...formData, height: e.value ?? null})} 
                                    min={100} max={250}
                                    className="w-full"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label htmlFor="weight" className="text-sm font-medium">体重 (kg)</label>
                                <InputNumber 
                                    id="weight" 
                                    value={formData.weight} 
                                    onValueChange={(e) => setFormData({...formData, weight: e.value ?? null})} 
                                    min={30} max={300}
                                    mode="decimal" 
                                    minFractionDigits={1}
                                    className="w-full"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label htmlFor="lifestyle" className="text-sm font-medium">生活作息</label>
                                <InputText 
                                    id="lifestyle" 
                                    value={formData.lifestyle} 
                                    onChange={(e) => setFormData({...formData, lifestyle: e.target.value})} 
                                    placeholder="如：朝九晚五，久坐办公"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 健身目标 */}
                    <div>
                        <h3 className="text-md font-semibold mb-4 text-surface-700">健身目标</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label htmlFor="fitness_goal" className="text-sm font-medium">健身目标</label>
                                <Dropdown 
                                    id="fitness_goal" 
                                    value={formData.fitness_goal} 
                                    options={FITNESS_GOAL_OPTIONS} 
                                    onChange={(e) => setFormData({...formData, fitness_goal: e.value})} 
                                    placeholder="选择健身目标"
                                    className="w-full"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label htmlFor="fitness_level" className="text-sm font-medium">当前水平</label>
                                <Dropdown 
                                    id="fitness_level" 
                                    value={formData.fitness_level} 
                                    options={FITNESS_LEVEL_OPTIONS} 
                                    onChange={(e) => setFormData({...formData, fitness_level: e.value})} 
                                    placeholder="选择健身水平"
                                    className="w-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 运动卡片 */}
                    <div>
                        <h3 className="text-md font-semibold mb-4 text-surface-700">运动数据卡片</h3>
                        <p className="text-sm text-surface-500 mb-4">选择您参与的运动类型，记录您的训练数据</p>
                        
                        {/* 卡片选择 */}
                        <div className="flex flex-wrap gap-3 mb-4">
                            {CARD_TYPES.map((card) => {
                                const isActive = formData.sport_cards.activeCards.includes(card.key);
                                const Icon = card.icon;
                                return (
                                    <div 
                                        key={card.key}
                                        onClick={() => toggleCard(card.key)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                                            isActive 
                                                ? 'border-primary bg-primary/10 text-primary' 
                                                : 'border-surface-200 bg-surface-50 text-surface-600 hover:border-surface-300'
                                        }`}
                                    >
                                        <Checkbox checked={isActive} onChange={() => toggleCard(card.key)} />
                                        <Icon size={18} />
                                        <span className="font-medium">{card.label}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* 力量举卡片 */}
                        {formData.sport_cards.activeCards.includes('powerlifting') && (
                            <div className="p-4 bg-orange-50 rounded-xl border border-orange-200 mb-4">
                                <h4 className="font-semibold text-orange-700 mb-3 flex items-center gap-2">
                                    <Dumbbell size={18} /> 力量举数据 (1RM)
                                </h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-orange-600">深蹲 (kg)</label>
                                        <InputNumber 
                                            value={formData.sport_cards.powerlifting.squat}
                                            onValueChange={(e) => updateCardData('powerlifting', 'squat', e.value ?? null)}
                                            min={0} max={500}
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-orange-600">卧推 (kg)</label>
                                        <InputNumber 
                                            value={formData.sport_cards.powerlifting.bench}
                                            onValueChange={(e) => updateCardData('powerlifting', 'bench', e.value ?? null)}
                                            min={0} max={500}
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-orange-600">硬拉 (kg)</label>
                                        <InputNumber 
                                            value={formData.sport_cards.powerlifting.deadlift}
                                            onValueChange={(e) => updateCardData('powerlifting', 'deadlift', e.value ?? null)}
                                            min={0} max={500}
                                            className="w-full"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 健美卡片 */}
                        {formData.sport_cards.activeCards.includes('bodybuilding') && (
                            <div className="p-4 bg-purple-50 rounded-xl border border-purple-200 mb-4">
                                <h4 className="font-semibold text-purple-700 mb-3 flex items-center gap-2">
                                    <User size={18} /> 健美数据
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-purple-600">胸围 (cm)</label>
                                        <InputNumber 
                                            value={formData.sport_cards.bodybuilding.chest}
                                            onValueChange={(e) => updateCardData('bodybuilding', 'chest', e.value ?? null)}
                                            min={0} max={200}
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-purple-600">臂围 (cm)</label>
                                        <InputNumber 
                                            value={formData.sport_cards.bodybuilding.arm}
                                            onValueChange={(e) => updateCardData('bodybuilding', 'arm', e.value ?? null)}
                                            min={0} max={100}
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-purple-600">腰围 (cm)</label>
                                        <InputNumber 
                                            value={formData.sport_cards.bodybuilding.waist}
                                            onValueChange={(e) => updateCardData('bodybuilding', 'waist', e.value ?? null)}
                                            min={0} max={200}
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-purple-600">臀围 (cm)</label>
                                        <InputNumber 
                                            value={formData.sport_cards.bodybuilding.hip}
                                            onValueChange={(e) => updateCardData('bodybuilding', 'hip', e.value ?? null)}
                                            min={0} max={200}
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-purple-600">体脂率 (%)</label>
                                        <InputNumber 
                                            value={formData.sport_cards.bodybuilding.bodyfat}
                                            onValueChange={(e) => updateCardData('bodybuilding', 'bodyfat', e.value ?? null)}
                                            min={0} max={100}
                                            mode="decimal"
                                            minFractionDigits={1}
                                            className="w-full"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 体能卡片 */}
                        {formData.sport_cards.activeCards.includes('fitness') && (
                            <div className="p-4 bg-green-50 rounded-xl border border-green-200 mb-4">
                                <h4 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
                                    <Activity size={18} /> 体能数据
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-green-600">引体向上 (个)</label>
                                        <InputNumber 
                                            value={formData.sport_cards.fitness.pullups}
                                            onValueChange={(e) => updateCardData('fitness', 'pullups', e.value ?? null)}
                                            min={0} max={100}
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-green-600">俯卧撑 (个)</label>
                                        <InputNumber 
                                            value={formData.sport_cards.fitness.pushups}
                                            onValueChange={(e) => updateCardData('fitness', 'pushups', e.value ?? null)}
                                            min={0} max={200}
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-green-600">平板支撑 (秒)</label>
                                        <InputNumber 
                                            value={formData.sport_cards.fitness.plank}
                                            onValueChange={(e) => updateCardData('fitness', 'plank', e.value ?? null)}
                                            min={0} max={600}
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-green-600">静息心率 (次/分)</label>
                                        <InputNumber 
                                            value={formData.sport_cards.fitness.restingHR}
                                            onValueChange={(e) => updateCardData('fitness', 'restingHR', e.value ?? null)}
                                            min={30} max={150}
                                            className="w-full"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Dialog>
        </div>
    );
};