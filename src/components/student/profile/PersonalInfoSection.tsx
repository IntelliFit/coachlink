import React, { useState } from 'react';
import { User, Edit, Dumbbell, Activity, Bike, Footprints } from 'lucide-react';
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
import { SportCards, getEmptySportCards } from '@/types/sportCards';

interface PersonalInfoSectionProps {
    data: ProfileData;
    onUpdate: () => void;
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
    { label: '初学者', value: 'beginner' },
    { label: '中级', value: 'intermediate' },
    { label: '高级', value: 'advanced' },
];

// 运动卡片类型 - 7 大类
const CARD_TYPES = [
    { key: 'powerlifting', label: '力量举', icon: Dumbbell, bgClass: 'bg-orange-50', borderClass: 'border-orange-200', textClass: 'text-orange-700' },
    { key: 'streetlifting', label: '街头力量举', icon: Dumbbell, bgClass: 'bg-lime-50', borderClass: 'border-lime-200', textClass: 'text-lime-700' },
    { key: 'calisthenics', label: '街头健身', icon: User, bgClass: 'bg-green-50', borderClass: 'border-green-200', textClass: 'text-green-700' },
    { key: 'weightlifting', label: '举重', icon: Dumbbell, bgClass: 'bg-red-50', borderClass: 'border-red-200', textClass: 'text-red-700' },
    { key: 'bodybuilding', label: '健美/形体', icon: User, bgClass: 'bg-purple-50', borderClass: 'border-purple-200', textClass: 'text-purple-700' },
    { key: 'running', label: '跑步', icon: Footprints, bgClass: 'bg-blue-50', borderClass: 'border-blue-200', textClass: 'text-blue-700' },
    { key: 'cycling', label: '骑行', icon: Bike, bgClass: 'bg-cyan-50', borderClass: 'border-cyan-200', textClass: 'text-cyan-700' },
];

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
    const { profile } = data;
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
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
            setIsEditing(false);
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

    // 更新卡片数据 (字符串类型)
    const updateCardDataString = (cardKey: string, field: string, value: string | null) => {
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

    const InfoItem = ({ label, value }: { label: string, value: string | number | null }) => (
        <div className="p-4 bg-surface-50 rounded-xl border border-surface-100">
            <div className="text-sm text-surface-500 mb-1">{label}</div>
            <div className="text-sm font-semibold text-surface-900">{value || '未填写'}</div>
        </div>
    );

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
                    onClick={() => { initFormData(); setIsEditing(true); }}
                />
            </div>

            {!profile ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, index) => (<InfoItemSkeleton key={index} />))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <InfoItem label="身高" value={profile?.height ? `${profile.height} cm` : null} />
                    <InfoItem label="体重" value={profile?.weight ? `${profile.weight} kg` : null} />
                    <InfoItem label="健身目标" value={profile?.fitness_goal || null} />
                    <InfoItem label="健身水平" value={getFitnessLevelDisplay(profile?.fitness_level)} />
                    <InfoItem label="生活作息" value={profile?.lifestyle || null} />
                </div>
            )}

            <Dialog 
                header="编辑个人资料" 
                visible={isEditing} 
                style={{ width: '95vw', maxWidth: '950px' }} 
                onHide={() => setIsEditing(false)}
                footer={
                    <div className="flex justify-end gap-2">
                        <Button label="取消" text onClick={() => setIsEditing(false)} />
                        <Button label="保存" loading={loading} onClick={handleSave} />
                    </div>
                }
            >
                <div className="flex flex-col gap-6 py-4 max-h-[70vh] overflow-y-auto">
                    {/* 基本信息 */}
                    <div>
                        <h3 className="text-md font-semibold mb-4 text-surface-700">基本信息</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="flex flex-col gap-2">
                                <label htmlFor="nickname" className="text-sm font-medium">昵称</label>
                                <InputText id="nickname" value={formData.nickname} onChange={(e) => setFormData({...formData, nickname: e.target.value})} />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label htmlFor="avatar" className="text-sm font-medium">头像</label>
                                <div className="flex items-center gap-3">
                                    <InputText id="avatar" value={formData.avatar_url} onChange={(e) => setFormData({...formData, avatar_url: e.target.value})} placeholder="粘贴图片URL" className="flex-1" />
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
                                    <Button label="清空" text size="small" onClick={() => setFormData({ ...formData, avatar_url: '' })} type="button" />
                                    {uploading && <span className="text-xs text-surface-500">上传中...</span>}
                                </div>
                                <p className="text-xs text-surface-500">支持 PNG/JPG/WEBP，≤2MB。</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label htmlFor="age" className="text-sm font-medium">年龄</label>
                                <InputNumber id="age" value={formData.age} onValueChange={(e) => setFormData({...formData, age: e.value ?? null})} min={10} max={100} suffix=" 岁" className="w-full" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label htmlFor="gender" className="text-sm font-medium">性别</label>
                                <Dropdown id="gender" value={formData.gender} options={GENDER_OPTIONS} onChange={(e) => setFormData({...formData, gender: e.value})} placeholder="选择性别" className="w-full" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label htmlFor="height" className="text-sm font-medium">身高 (cm)</label>
                                <InputNumber id="height" value={formData.height} onValueChange={(e) => setFormData({...formData, height: e.value ?? null})} min={100} max={250} className="w-full" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label htmlFor="weight" className="text-sm font-medium">体重 (kg)</label>
                                <InputNumber id="weight" value={formData.weight} onValueChange={(e) => setFormData({...formData, weight: e.value ?? null})} min={30} max={300} mode="decimal" minFractionDigits={1} className="w-full" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label htmlFor="fitness_goal" className="text-sm font-medium">健身目标</label>
                                <Dropdown id="fitness_goal" value={formData.fitness_goal} options={FITNESS_GOAL_OPTIONS} onChange={(e) => setFormData({...formData, fitness_goal: e.value})} placeholder="选择健身目标" className="w-full" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label htmlFor="fitness_level" className="text-sm font-medium">当前水平</label>
                                <Dropdown id="fitness_level" value={formData.fitness_level} options={FITNESS_LEVEL_OPTIONS} onChange={(e) => setFormData({...formData, fitness_level: e.value})} placeholder="选择健身水平" className="w-full" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label htmlFor="lifestyle" className="text-sm font-medium">生活作息</label>
                                <InputText id="lifestyle" value={formData.lifestyle} onChange={(e) => setFormData({...formData, lifestyle: e.target.value})} placeholder="如：朝九晚五" />
                            </div>
                        </div>
                    </div>

                    {/* 运动卡片 */}
                    <div>
                        <h3 className="text-md font-semibold mb-4 text-surface-700">运动数据卡片</h3>
                        <p className="text-sm text-surface-500 mb-4">选择您参与的运动类型，记录您的训练数据（全部选填）</p>
                        
                        {/* 卡片选择 - 7 个类型 */}
                        <div className="flex flex-wrap gap-3 mb-4">
                            {CARD_TYPES.map((card) => {
                                const isActive = formData.sport_cards.activeCards.includes(card.key);
                                const Icon = card.icon;
                                return (
                                    <div 
                                        key={card.key}
                                        onClick={() => toggleCard(card.key)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                                            isActive ? 'border-primary bg-primary/10 text-primary' : 'border-surface-200 bg-surface-50 text-surface-600 hover:border-surface-300'
                                        }`}
                                    >
                                        <Checkbox checked={isActive} onChange={() => toggleCard(card.key)} />
                                        <Icon size={18} />
                                        <span className="font-medium">{card.label}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* 1. 力量举 */}
                        {formData.sport_cards.activeCards.includes('powerlifting') && (
                            <div className="p-4 bg-orange-50 rounded-xl border border-orange-200 mb-4">
                                <h4 className="font-semibold text-orange-700 mb-3 flex items-center gap-2"><Dumbbell size={18} /> 力量举数据</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="flex flex-col gap-1"><label className="text-xs text-orange-600">深蹲 1RM (kg)</label><InputNumber value={formData.sport_cards.powerlifting?.squat} onValueChange={(e) => updateCardData('powerlifting', 'squat', e.value ?? null)} min={0} max={500} className="w-full" /></div>
                                    <div className="flex flex-col gap-1"><label className="text-xs text-orange-600">卧推 1RM (kg)</label><InputNumber value={formData.sport_cards.powerlifting?.bench} onValueChange={(e) => updateCardData('powerlifting', 'bench', e.value ?? null)} min={0} max={500} className="w-full" /></div>
                                    <div className="flex flex-col gap-1"><label className="text-xs text-orange-600">硬拉 1RM (kg)</label><InputNumber value={formData.sport_cards.powerlifting?.deadlift} onValueChange={(e) => updateCardData('powerlifting', 'deadlift', e.value ?? null)} min={0} max={500} className="w-full" /></div>
                                </div>
                            </div>
                        )}

                        {/* 2. 街头力量举 */}
                        {formData.sport_cards.activeCards.includes('streetlifting') && (
                            <div className="p-4 bg-lime-50 rounded-xl border border-lime-200 mb-4">
                                <h4 className="font-semibold text-lime-700 mb-3 flex items-center gap-2"><Dumbbell size={18} /> 街头力量举数据</h4>
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="flex flex-col gap-1"><label className="text-xs text-lime-600">负重引体 (kg)</label><InputNumber value={formData.sport_cards.streetlifting?.weightedPullup} onValueChange={(e) => updateCardData('streetlifting', 'weightedPullup', e.value ?? null)} min={0} max={200} className="w-full" /></div>
                                    <div className="flex flex-col gap-1"><label className="text-xs text-lime-600">负重双杠 (kg)</label><InputNumber value={formData.sport_cards.streetlifting?.weightedDip} onValueChange={(e) => updateCardData('streetlifting', 'weightedDip', e.value ?? null)} min={0} max={200} className="w-full" /></div>
                                    <div className="flex flex-col gap-1"><label className="text-xs text-lime-600">负重双力臂 (kg)</label><InputNumber value={formData.sport_cards.streetlifting?.weightedMuscleUp} onValueChange={(e) => updateCardData('streetlifting', 'weightedMuscleUp', e.value ?? null)} min={0} max={200} className="w-full" /></div>
                                    <div className="flex flex-col gap-1"><label className="text-xs text-lime-600">深蹲 (kg)</label><InputNumber value={formData.sport_cards.streetlifting?.squat} onValueChange={(e) => updateCardData('streetlifting', 'squat', e.value ?? null)} min={0} max={500} className="w-full" /></div>
                                </div>
                            </div>
                        )}

                        {/* 3. 街头健身 */}
                        {formData.sport_cards.activeCards.includes('calisthenics') && (
                            <div className="p-4 bg-green-50 rounded-xl border border-green-200 mb-4">
                                <h4 className="font-semibold text-green-700 mb-3 flex items-center gap-2"><User size={18} /> 街头健身数据</h4>
                                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                                    <div className="flex flex-col gap-1"><label className="text-xs text-green-600">最大引体 (次)</label><InputNumber value={formData.sport_cards.calisthenics?.maxPullups} onValueChange={(e) => updateCardData('calisthenics', 'maxPullups', e.value ?? null)} min={0} max={100} className="w-full" /></div>
                                    <div className="flex flex-col gap-1"><label className="text-xs text-green-600">最大双杠 (次)</label><InputNumber value={formData.sport_cards.calisthenics?.maxDips} onValueChange={(e) => updateCardData('calisthenics', 'maxDips', e.value ?? null)} min={0} max={100} className="w-full" /></div>
                                    <div className="flex flex-col gap-1"><label className="text-xs text-green-600">双力臂 (次)</label><InputNumber value={formData.sport_cards.calisthenics?.maxMuscleUps} onValueChange={(e) => updateCardData('calisthenics', 'maxMuscleUps', e.value ?? null)} min={0} max={50} className="w-full" /></div>
                                    <div className="flex flex-col gap-1"><label className="text-xs text-green-600">前水平 (秒)</label><InputNumber value={formData.sport_cards.calisthenics?.frontLever} onValueChange={(e) => updateCardData('calisthenics', 'frontLever', e.value ?? null)} min={0} max={120} className="w-full" /></div>
                                    <div className="flex flex-col gap-1"><label className="text-xs text-green-600">俄挺 (秒)</label><InputNumber value={formData.sport_cards.calisthenics?.planche} onValueChange={(e) => updateCardData('calisthenics', 'planche', e.value ?? null)} min={0} max={120} className="w-full" /></div>
                                    <div className="flex flex-col gap-1"><label className="text-xs text-green-600">人旗 (秒)</label><InputNumber value={formData.sport_cards.calisthenics?.humanFlag} onValueChange={(e) => updateCardData('calisthenics', 'humanFlag', e.value ?? null)} min={0} max={120} className="w-full" /></div>
                                </div>
                            </div>
                        )}

                        {/* 4. 举重 */}
                        {formData.sport_cards.activeCards.includes('weightlifting') && (
                            <div className="p-4 bg-red-50 rounded-xl border border-red-200 mb-4">
                                <h4 className="font-semibold text-red-700 mb-3 flex items-center gap-2"><Dumbbell size={18} /> 举重数据</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1"><label className="text-xs text-red-600">抓举 1RM (kg)</label><InputNumber value={formData.sport_cards.weightlifting?.snatch} onValueChange={(e) => updateCardData('weightlifting', 'snatch', e.value ?? null)} min={0} max={300} className="w-full" /></div>
                                    <div className="flex flex-col gap-1"><label className="text-xs text-red-600">挺举 1RM (kg)</label><InputNumber value={formData.sport_cards.weightlifting?.cleanAndJerk} onValueChange={(e) => updateCardData('weightlifting', 'cleanAndJerk', e.value ?? null)} min={0} max={400} className="w-full" /></div>
                                </div>
                            </div>
                        )}

                        {/* 5. 健美 */}
                        {formData.sport_cards.activeCards.includes('bodybuilding') && (
                            <div className="p-4 bg-purple-50 rounded-xl border border-purple-200 mb-4">
                                <h4 className="font-semibold text-purple-700 mb-3 flex items-center gap-2"><User size={18} /> 健美数据</h4>
                                <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
                                    <div className="flex flex-col gap-1"><label className="text-xs text-purple-600">体脂率 (%)</label><InputNumber value={formData.sport_cards.bodybuilding?.bodyfat} onValueChange={(e) => updateCardData('bodybuilding', 'bodyfat', e.value ?? null)} min={0} max={50} mode="decimal" minFractionDigits={1} className="w-full" /></div>
                                    <div className="flex flex-col gap-1"><label className="text-xs text-purple-600">胸围 (cm)</label><InputNumber value={formData.sport_cards.bodybuilding?.chest} onValueChange={(e) => updateCardData('bodybuilding', 'chest', e.value ?? null)} min={0} max={200} className="w-full" /></div>
                                    <div className="flex flex-col gap-1"><label className="text-xs text-purple-600">臂围 (cm)</label><InputNumber value={formData.sport_cards.bodybuilding?.arm} onValueChange={(e) => updateCardData('bodybuilding', 'arm', e.value ?? null)} min={0} max={80} className="w-full" /></div>
                                    <div className="flex flex-col gap-1"><label className="text-xs text-purple-600">腰围 (cm)</label><InputNumber value={formData.sport_cards.bodybuilding?.waist} onValueChange={(e) => updateCardData('bodybuilding', 'waist', e.value ?? null)} min={0} max={150} className="w-full" /></div>
                                    <div className="flex flex-col gap-1"><label className="text-xs text-purple-600">臀围 (cm)</label><InputNumber value={formData.sport_cards.bodybuilding?.hip} onValueChange={(e) => updateCardData('bodybuilding', 'hip', e.value ?? null)} min={0} max={150} className="w-full" /></div>
                                    <div className="flex flex-col gap-1"><label className="text-xs text-purple-600">大腿 (cm)</label><InputNumber value={formData.sport_cards.bodybuilding?.thigh} onValueChange={(e) => updateCardData('bodybuilding', 'thigh', e.value ?? null)} min={0} max={100} className="w-full" /></div>
                                    <div className="flex flex-col gap-1"><label className="text-xs text-purple-600">小腿 (cm)</label><InputNumber value={formData.sport_cards.bodybuilding?.calf} onValueChange={(e) => updateCardData('bodybuilding', 'calf', e.value ?? null)} min={0} max={80} className="w-full" /></div>
                                </div>
                            </div>
                        )}

                        {/* 6. 跑步 */}
                        {formData.sport_cards.activeCards.includes('running') && (
                            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 mb-4">
                                <h4 className="font-semibold text-blue-700 mb-3 flex items-center gap-2"><Footprints size={18} /> 跑步数据</h4>
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="flex flex-col gap-1"><label className="text-xs text-blue-600">5公里用时</label><InputText value={formData.sport_cards.running?.fiveK || ''} onChange={(e) => updateCardDataString('running', 'fiveK', e.target.value || null)} placeholder="如 25:30" className="w-full" /></div>
                                    <div className="flex flex-col gap-1"><label className="text-xs text-blue-600">10公里用时</label><InputText value={formData.sport_cards.running?.tenK || ''} onChange={(e) => updateCardDataString('running', 'tenK', e.target.value || null)} placeholder="如 55:00" className="w-full" /></div>
                                    <div className="flex flex-col gap-1"><label className="text-xs text-blue-600">半马用时</label><InputText value={formData.sport_cards.running?.halfMarathon || ''} onChange={(e) => updateCardDataString('running', 'halfMarathon', e.target.value || null)} placeholder="如 2:05:00" className="w-full" /></div>
                                    <div className="flex flex-col gap-1"><label className="text-xs text-blue-600">全马用时</label><InputText value={formData.sport_cards.running?.marathon || ''} onChange={(e) => updateCardDataString('running', 'marathon', e.target.value || null)} placeholder="如 4:30:00" className="w-full" /></div>
                                </div>
                            </div>
                        )}

                        {/* 7. 骑行 */}
                        {formData.sport_cards.activeCards.includes('cycling') && (
                            <div className="p-4 bg-cyan-50 rounded-xl border border-cyan-200 mb-4">
                                <h4 className="font-semibold text-cyan-700 mb-3 flex items-center gap-2"><Bike size={18} /> 骑行数据</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="flex flex-col gap-1"><label className="text-xs text-cyan-600">FTP功率 (W)</label><InputNumber value={formData.sport_cards.cycling?.ftp} onValueChange={(e) => updateCardData('cycling', 'ftp', e.value ?? null)} min={0} max={500} className="w-full" /></div>
                                    <div className="flex flex-col gap-1"><label className="text-xs text-cyan-600">最大功率 (W)</label><InputNumber value={formData.sport_cards.cycling?.maxPower} onValueChange={(e) => updateCardData('cycling', 'maxPower', e.value ?? null)} min={0} max={2000} className="w-full" /></div>
                                    <div className="flex flex-col gap-1"><label className="text-xs text-cyan-600">最长单骑 (km)</label><InputNumber value={formData.sport_cards.cycling?.maxDistance} onValueChange={(e) => updateCardData('cycling', 'maxDistance', e.value ?? null)} min={0} max={500} className="w-full" /></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Dialog>
        </div>
    );
};