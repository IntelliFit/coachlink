'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { FloatLabel } from 'primereact/floatlabel';
import { ProgressBar } from 'primereact/progressbar';
import { useToastContext } from '@/context/ToastContext';
import { studentService } from '@/app/service/studentService';
import { Dumbbell, User, Activity, Bike, Footprints } from 'lucide-react';
import { SportCards, getEmptySportCards, getPowerliftingTotal, getStreetliftingTotal, getWeightliftingTotal } from '@/types/sportCards';
import { useOnboardingModal } from './OnboardingModalContext';
import { useSession } from 'next-auth/react';

// 卡片类型配置 - 7 大类
const CARD_TYPES = [
    { key: 'powerlifting', label: '力量举', icon: Dumbbell, color: 'bg-orange-100 text-orange-600', active: 'bg-orange-500/20 border-orange-500', bgClass: 'bg-orange-50', borderClass: 'border-orange-200', textClass: 'text-orange-700' },
    { key: 'streetlifting', label: '街头力量举', icon: Dumbbell, color: 'bg-lime-100 text-lime-600', active: 'bg-lime-500/20 border-lime-500', bgClass: 'bg-lime-50', borderClass: 'border-lime-200', textClass: 'text-lime-700' },
    { key: 'calisthenics', label: '街头健身', icon: User, color: 'bg-green-100 text-green-600', active: 'bg-green-500/20 border-green-500', bgClass: 'bg-green-50', borderClass: 'border-green-200', textClass: 'text-green-700' },
    { key: 'weightlifting', label: '举重', icon: Dumbbell, color: 'bg-red-100 text-red-600', active: 'bg-red-500/20 border-red-500', bgClass: 'bg-red-50', borderClass: 'border-red-200', textClass: 'text-red-700' },
    { key: 'bodybuilding', label: '健美/形体', icon: User, color: 'bg-purple-100 text-purple-600', active: 'bg-purple-500/20 border-purple-500', bgClass: 'bg-purple-50', borderClass: 'border-purple-200', textClass: 'text-purple-700' },
    { key: 'running', label: '跑步', icon: Footprints, color: 'bg-blue-100 text-blue-600', active: 'bg-blue-500/20 border-blue-500', bgClass: 'bg-blue-50', borderClass: 'border-blue-200', textClass: 'text-blue-700' },
    { key: 'cycling', label: '骑行', icon: Bike, color: 'bg-cyan-100 text-cyan-600', active: 'bg-cyan-500/20 border-cyan-500', bgClass: 'bg-cyan-50', borderClass: 'border-cyan-200', textClass: 'text-cyan-700' },
];

interface FormData {
    nickname: string;
    age: number | null;
    gender: string;
    height: number | null;
    weight: number | null;
    lifestyle: string;
    fitnessGoal: string;
    fitnessLevel: string;
    sportCards: SportCards;
}

const GENDER_OPTIONS = [
    { label: '男', value: 'male' },
    { label: '女', value: 'female' },
];

const FITNESS_GOAL_OPTIONS = [
    { label: '减脂塑形', value: '减脂' },
    { label: '增肌强身', value: '增肌' },
    { label: '力量提升', value: '力量提升' },
    { label: '体能改善', value: '体能改善' },
];

const FITNESS_LEVEL_OPTIONS = [
    { label: '初学者', value: 'beginner' },
    { label: '中级', value: 'intermediate' },
    { label: '高级', value: 'advanced' },
];

interface OnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { showToast } = useToastContext();
    const { suppressOnboardingModalOnce } = useOnboardingModal();
    const { update: updateSession } = useSession();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState<FormData>({
        nickname: '',
        age: null,
        gender: '',
        height: null,
        weight: null,
        lifestyle: '',
        fitnessGoal: '',
        fitnessLevel: '',
        sportCards: getEmptySportCards(),
    });

    const totalSteps = 2;
    const progress = (step / totalSteps) * 100;

    // 切换卡片选择
    const toggleCard = (cardKey: string) => {
        const activeCards = formData.sportCards.activeCards.includes(cardKey)
            ? formData.sportCards.activeCards.filter(c => c !== cardKey)
            : [...formData.sportCards.activeCards, cardKey];
        setFormData({
            ...formData,
            sportCards: { ...formData.sportCards, activeCards },
        });
    };

    // 更新卡片数据 (数字类型)
    const updateCardData = (cardKey: string, field: string, value: number | null) => {
        setFormData({
            ...formData,
            sportCards: {
                ...formData.sportCards,
                [cardKey]: {
                    ...(formData.sportCards[cardKey as keyof SportCards] as object),
                    [field]: value,
                },
            },
        });
    };

    // 更新卡片数据 (字符串类型，用于跑步时间等)
    const updateCardDataString = (cardKey: string, field: string, value: string | null) => {
        setFormData({
            ...formData,
            sportCards: {
                ...formData.sportCards,
                [cardKey]: {
                    ...(formData.sportCards[cardKey as keyof SportCards] as object),
                    [field]: value,
                },
            },
        });
    };

    // 验证第一步
    const validateStep1 = () => {
        if (!formData.nickname.trim()) {
            showToast({ severity: 'warn', summary: '请填写昵称' });
            return false;
        }
        if (!formData.age || formData.age < 10 || formData.age > 100) {
            showToast({ severity: 'warn', summary: '请填写有效的年龄' });
            return false;
        }
        if (!formData.gender) {
            showToast({ severity: 'warn', summary: '请选择性别' });
            return false;
        }
        if (!formData.height || formData.height < 100 || formData.height > 250) {
            showToast({ severity: 'warn', summary: '请填写有效的身高' });
            return false;
        }
        if (!formData.weight || formData.weight < 30 || formData.weight > 300) {
            showToast({ severity: 'warn', summary: '请填写有效的体重' });
            return false;
        }
        if (!formData.fitnessGoal) {
            showToast({ severity: 'warn', summary: '请选择健身目标' });
            return false;
        }
        if (!formData.fitnessLevel) {
            showToast({ severity: 'warn', summary: '请选择当前健身水平' });
            return false;
        }
        return true;
    };

    const handleNext = () => {
        if (step === 1 && !validateStep1()) return;
        setStep(step + 1);
    };

    const handleBack = () => {
        setStep(step - 1);
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const result = await studentService.updateProfile({
                nickname: formData.nickname,
                age: formData.age,
                gender: formData.gender,
                height: formData.height,
                weight: formData.weight,
                lifestyle: formData.lifestyle,
                fitness_goal: formData.fitnessGoal,
                fitness_level: formData.fitnessLevel,
                sport_cards: formData.sportCards,
                onboarding_completed: true,
            });

            if (result) {
                showToast({ severity: 'success', summary: '档案设置完成！' });
                // 防止 session.profile 未即时更新导致重新弹出
                suppressOnboardingModalOnce();
                // 主动刷新 NextAuth session（昵称/头像/onboarding_completed 依赖 session.profile）
                try {
                    await updateSession();
                } catch (e) {
                    console.warn('[OnboardingModal] Failed to update session after profile update', e);
                }
                onClose();
                setTimeout(() => {
                    // 如果当前不在今日训练页，再跳转过去；避免 replace/refresh 造成的路由闪烁
                    if (pathname !== '/today-training') {
                        router.replace('/today-training');
                    }
                }, 300);
            } else {
                showToast({ severity: 'error', summary: '保存失败', detail: 'API未返回结果' });
            }
        } catch (error: any) {
            const errorMessage = error?.response?.data?.message || error?.message || '未知错误';
            showToast({ severity: 'error', summary: '保存失败', detail: errorMessage, life: 5000 });
        } finally {
            setLoading(false);
        }
    };

    const headerContent = (
        <div className="flex items-center gap-3">
            <img src="/favicon.jpg" alt="CoachLink Logo" className="h-10 rounded-lg" />
            <div>
                <h2 className="text-xl font-bold">完善您的档案</h2>
                <p className="text-sm text-surface-500">帮助教练更好地了解您</p>
            </div>
        </div>
    );

    return (
        <Dialog
            header={headerContent}
            visible={isOpen}
            onHide={onClose}
            style={{ width: '700px', maxWidth: '95vw' }}
            modal
            blockScroll
            dismissableMask={false}
            closable={true}
            className="onboarding-modal"
        >
            {/* 进度条 */}
            <div className="mb-6">
                <ProgressBar value={progress} showValue={false} style={{ height: '6px' }} />
                <div className="flex justify-between mt-2 text-xs text-surface-500">
                    <span>第 {step} 步 / 共 {totalSteps} 步</span>
                    <span>{step === 1 ? '基本信息' : '运动数据'}</span>
                </div>
            </div>

            {/* Step 1: 基本信息 */}
            {step === 1 && (
                <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-surface-800 flex items-center gap-2">
                        <User className="w-5 h-5 text-blue-500" />
                        基本信息
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 mb-2">
                            <FloatLabel>
                                <InputText
                                    id="nickname"
                                    value={formData.nickname}
                                    onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                                    className="w-full"
                                />
                                <label htmlFor="nickname">昵称 <span className="text-red-500">*</span></label>
                            </FloatLabel>
                            <small className="text-surface-400 text-xs mt-1 block">这将是您在平台上的主要显示名称</small>
                        </div>

                        <FloatLabel className='mb-2'>
                            <InputNumber
                                id="age"
                                value={formData.age}
                                onValueChange={(e) => setFormData({ ...formData, age: e.value ?? null })}
                                className="w-full"
                                suffix=" 岁"
                                min={10}
                                max={100}
                            />
                            <label htmlFor="age">年龄 <span className="text-red-500">*</span></label>
                        </FloatLabel>

                        <Dropdown
                            id="gender"
                            value={formData.gender}
                            options={GENDER_OPTIONS}
                            onChange={(e) => setFormData({ ...formData, gender: e.value })}
                            className="w-full mb-2"
                            placeholder="性别 *"
                        />

                        <FloatLabel className='mb-2'>
                            <InputNumber
                                id="height"
                                value={formData.height}
                                onValueChange={(e) => setFormData({ ...formData, height: e.value ?? null })}
                                className="w-full"
                                suffix=" cm"
                                min={100}
                                max={250}
                            />
                            <label htmlFor="height">身高 <span className="text-red-500">*</span></label>
                        </FloatLabel>

                        <FloatLabel className='mb-2'>
                            <InputNumber
                                id="weight"
                                value={formData.weight}
                                onValueChange={(e) => setFormData({ ...formData, weight: e.value ?? null })}
                                className="w-full"
                                suffix=" kg"
                                min={30}
                                max={300}
                            />
                            <label htmlFor="weight">体重 <span className="text-red-500">*</span></label>
                        </FloatLabel>

                        <Dropdown
                            id="fitnessGoal"
                            value={formData.fitnessGoal}
                            options={FITNESS_GOAL_OPTIONS}
                            onChange={(e) => setFormData({ ...formData, fitnessGoal: e.value })}
                            className="w-full mb-2"
                            placeholder="健身目标 *"
                        />

                        <Dropdown
                            id="fitnessLevel"
                            value={formData.fitnessLevel}
                            options={FITNESS_LEVEL_OPTIONS}
                            onChange={(e) => setFormData({ ...formData, fitnessLevel: e.value })}
                            className="w-full mb-2"
                            placeholder="当前水平 *"
                        />

                        <div className="col-span-2">
                            <FloatLabel>
                                <InputText
                                    id="lifestyle"
                                    value={formData.lifestyle}
                                    onChange={(e) => setFormData({ ...formData, lifestyle: e.target.value })}
                                    className="w-full"
                                    placeholder="如：朝九晚五，久坐办公"
                                />
                                <label htmlFor="lifestyle">生活作息（选填）</label>
                            </FloatLabel>
                        </div>
                    </div>

                    <Button
                        label="下一步"
                        icon="pi pi-arrow-right"
                        iconPos="right"
                        onClick={handleNext}
                        className="w-full"
                    />
                </div>
            )}

            {/* Step 2: 运动数据卡片 */}
            {step === 2 && (
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                    <h3 className="text-lg font-semibold text-surface-800 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-green-500" />
                        运动数据卡片
                    </h3>
                    <p className="text-sm text-surface-500">选择您关注的运动类型，填写相关数据（可多选，全部选填）</p>

                    {/* 卡片选择器 - 7 个类型 */}
                    <div className="grid grid-cols-4 gap-3">
                        {CARD_TYPES.map((card) => {
                            const Icon = card.icon;
                            const isActive = formData.sportCards.activeCards.includes(card.key);
                            return (
                                <div
                                    key={card.key}
                                    onClick={() => toggleCard(card.key)}
                                    className={`cursor-pointer p-3 rounded-xl border-2 transition-all text-center ${isActive
                                        ? `${card.active}`
                                        : 'border-surface-200 hover:border-surface-300'
                                    }`}
                                >
                                    <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center ${card.color}`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="mt-2 text-xs font-medium text-surface-700">{card.label}</div>
                                    {isActive && (
                                        <i className="pi pi-check-circle text-primary-500 mt-1" />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* 1. 力量举卡片表单 */}
                    {formData.sportCards.activeCards.includes('powerlifting') && (
                        <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                            <h4 className="text-sm font-semibold text-orange-700 mb-3 flex items-center gap-2">
                                <Dumbbell className="w-4 h-4" />
                                力量举数据
                            </h4>
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="pl_squat" value={formData.sportCards.powerlifting?.squat} onValueChange={(e) => updateCardData('powerlifting', 'squat', e.value ?? null)} className="w-full" suffix=" kg" />
                                    <label htmlFor="pl_squat">深蹲 1RM</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="pl_bench" value={formData.sportCards.powerlifting?.bench} onValueChange={(e) => updateCardData('powerlifting', 'bench', e.value ?? null)} className="w-full" suffix=" kg" />
                                    <label htmlFor="pl_bench">卧推 1RM</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="pl_deadlift" value={formData.sportCards.powerlifting?.deadlift} onValueChange={(e) => updateCardData('powerlifting', 'deadlift', e.value ?? null)} className="w-full" suffix=" kg" />
                                    <label htmlFor="pl_deadlift">硬拉 1RM</label>
                                </FloatLabel>
                                <div className="flex items-center justify-center bg-orange-100 rounded-lg p-2 mb-4">
                                    <span className="text-sm text-orange-700">总和: <strong>{getPowerliftingTotal(formData.sportCards.powerlifting)} kg</strong></span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. 街头力量举卡片表单 */}
                    {formData.sportCards.activeCards.includes('streetlifting') && (
                        <div className="p-4 bg-lime-50 rounded-xl border border-lime-200">
                            <h4 className="text-sm font-semibold text-lime-700 mb-3 flex items-center gap-2">
                                <Dumbbell className="w-4 h-4" />
                                街头力量举数据
                            </h4>
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="sl_pullup" value={formData.sportCards.streetlifting?.weightedPullup} onValueChange={(e) => updateCardData('streetlifting', 'weightedPullup', e.value ?? null)} className="w-full" suffix=" kg" />
                                    <label htmlFor="sl_pullup">负重引体 1RM</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="sl_dip" value={formData.sportCards.streetlifting?.weightedDip} onValueChange={(e) => updateCardData('streetlifting', 'weightedDip', e.value ?? null)} className="w-full" suffix=" kg" />
                                    <label htmlFor="sl_dip">负重双杠 1RM</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="sl_muscleup" value={formData.sportCards.streetlifting?.weightedMuscleUp} onValueChange={(e) => updateCardData('streetlifting', 'weightedMuscleUp', e.value ?? null)} className="w-full" suffix=" kg" />
                                    <label htmlFor="sl_muscleup">负重双力臂 1RM</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="sl_squat" value={formData.sportCards.streetlifting?.squat} onValueChange={(e) => updateCardData('streetlifting', 'squat', e.value ?? null)} className="w-full" suffix=" kg" />
                                    <label htmlFor="sl_squat">深蹲 1RM</label>
                                </FloatLabel>
                            </div>
                        </div>
                    )}

                    {/* 3. 街头健身卡片表单 */}
                    {formData.sportCards.activeCards.includes('calisthenics') && (
                        <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                            <h4 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
                                <User className="w-4 h-4" />
                                街头健身数据
                            </h4>
                            <div className="grid grid-cols-3 gap-3 pt-2">
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="cal_pullups" value={formData.sportCards.calisthenics?.maxPullups} onValueChange={(e) => updateCardData('calisthenics', 'maxPullups', e.value ?? null)} className="w-full" suffix=" 次" />
                                    <label htmlFor="cal_pullups">最大引体</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="cal_dips" value={formData.sportCards.calisthenics?.maxDips} onValueChange={(e) => updateCardData('calisthenics', 'maxDips', e.value ?? null)} className="w-full" suffix=" 次" />
                                    <label htmlFor="cal_dips">最大双杠</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="cal_muscleups" value={formData.sportCards.calisthenics?.maxMuscleUps} onValueChange={(e) => updateCardData('calisthenics', 'maxMuscleUps', e.value ?? null)} className="w-full" suffix=" 次" />
                                    <label htmlFor="cal_muscleups">最大双力臂</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="cal_frontlever" value={formData.sportCards.calisthenics?.frontLever} onValueChange={(e) => updateCardData('calisthenics', 'frontLever', e.value ?? null)} className="w-full" suffix=" 秒" />
                                    <label htmlFor="cal_frontlever">前水平</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="cal_planche" value={formData.sportCards.calisthenics?.planche} onValueChange={(e) => updateCardData('calisthenics', 'planche', e.value ?? null)} className="w-full" suffix=" 秒" />
                                    <label htmlFor="cal_planche">俄式挺身</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="cal_humanflag" value={formData.sportCards.calisthenics?.humanFlag} onValueChange={(e) => updateCardData('calisthenics', 'humanFlag', e.value ?? null)} className="w-full" suffix=" 秒" />
                                    <label htmlFor="cal_humanflag">人体旗帜</label>
                                </FloatLabel>
                            </div>
                        </div>
                    )}

                    {/* 4. 举重卡片表单 */}
                    {formData.sportCards.activeCards.includes('weightlifting') && (
                        <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                            <h4 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                                <Dumbbell className="w-4 h-4" />
                                举重数据
                            </h4>
                            <div className="grid grid-cols-3 gap-3 pt-2">
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="wl_snatch" value={formData.sportCards.weightlifting?.snatch} onValueChange={(e) => updateCardData('weightlifting', 'snatch', e.value ?? null)} className="w-full" suffix=" kg" />
                                    <label htmlFor="wl_snatch">抓举 1RM</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="wl_cj" value={formData.sportCards.weightlifting?.cleanAndJerk} onValueChange={(e) => updateCardData('weightlifting', 'cleanAndJerk', e.value ?? null)} className="w-full" suffix=" kg" />
                                    <label htmlFor="wl_cj">挺举 1RM</label>
                                </FloatLabel>
                                <div className="flex items-center justify-center bg-red-100 rounded-lg p-2 mb-4">
                                    <span className="text-sm text-red-700">总成绩: <strong>{getWeightliftingTotal(formData.sportCards.weightlifting)} kg</strong></span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 5. 健美卡片表单 */}
                    {formData.sportCards.activeCards.includes('bodybuilding') && (
                        <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                            <h4 className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-2">
                                <User className="w-4 h-4" />
                                健美/形体数据
                            </h4>
                            <div className="grid grid-cols-4 gap-3 pt-2">
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="bb_bodyfat" value={formData.sportCards.bodybuilding?.bodyfat} onValueChange={(e) => updateCardData('bodybuilding', 'bodyfat', e.value ?? null)} className="w-full" suffix=" %" minFractionDigits={1} />
                                    <label htmlFor="bb_bodyfat">体脂率</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="bb_chest" value={formData.sportCards.bodybuilding?.chest} onValueChange={(e) => updateCardData('bodybuilding', 'chest', e.value ?? null)} className="w-full" suffix=" cm" />
                                    <label htmlFor="bb_chest">胸围</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="bb_arm" value={formData.sportCards.bodybuilding?.arm} onValueChange={(e) => updateCardData('bodybuilding', 'arm', e.value ?? null)} className="w-full" suffix=" cm" />
                                    <label htmlFor="bb_arm">臂围</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="bb_waist" value={formData.sportCards.bodybuilding?.waist} onValueChange={(e) => updateCardData('bodybuilding', 'waist', e.value ?? null)} className="w-full" suffix=" cm" />
                                    <label htmlFor="bb_waist">腰围</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="bb_hip" value={formData.sportCards.bodybuilding?.hip} onValueChange={(e) => updateCardData('bodybuilding', 'hip', e.value ?? null)} className="w-full" suffix=" cm" />
                                    <label htmlFor="bb_hip">臀围</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="bb_thigh" value={formData.sportCards.bodybuilding?.thigh} onValueChange={(e) => updateCardData('bodybuilding', 'thigh', e.value ?? null)} className="w-full" suffix=" cm" />
                                    <label htmlFor="bb_thigh">大腿围</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="bb_calf" value={formData.sportCards.bodybuilding?.calf} onValueChange={(e) => updateCardData('bodybuilding', 'calf', e.value ?? null)} className="w-full" suffix=" cm" />
                                    <label htmlFor="bb_calf">小腿围</label>
                                </FloatLabel>
                            </div>
                        </div>
                    )}

                    {/* 6. 跑步卡片表单 */}
                    {formData.sportCards.activeCards.includes('running') && (
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                            <h4 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
                                <Footprints className="w-4 h-4" />
                                跑步数据
                            </h4>
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <FloatLabel className='mb-4'>
                                    <InputText id="run_5k" value={formData.sportCards.running?.fiveK || ''} onChange={(e) => updateCardDataString('running', 'fiveK', e.target.value || null)} className="w-full" placeholder="如 25:30" />
                                    <label htmlFor="run_5k">5公里用时</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputText id="run_10k" value={formData.sportCards.running?.tenK || ''} onChange={(e) => updateCardDataString('running', 'tenK', e.target.value || null)} className="w-full" placeholder="如 55:00" />
                                    <label htmlFor="run_10k">10公里用时</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputText id="run_half" value={formData.sportCards.running?.halfMarathon || ''} onChange={(e) => updateCardDataString('running', 'halfMarathon', e.target.value || null)} className="w-full" placeholder="如 2:05:00" />
                                    <label htmlFor="run_half">半马用时</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputText id="run_full" value={formData.sportCards.running?.marathon || ''} onChange={(e) => updateCardDataString('running', 'marathon', e.target.value || null)} className="w-full" placeholder="如 4:30:00" />
                                    <label htmlFor="run_full">全马用时</label>
                                </FloatLabel>
                            </div>
                        </div>
                    )}

                    {/* 7. 骑行卡片表单 */}
                    {formData.sportCards.activeCards.includes('cycling') && (
                        <div className="p-4 bg-cyan-50 rounded-xl border border-cyan-200">
                            <h4 className="text-sm font-semibold text-cyan-700 mb-3 flex items-center gap-2">
                                <Bike className="w-4 h-4" />
                                骑行数据
                            </h4>
                            <div className="grid grid-cols-3 gap-3 pt-2">
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="cyc_ftp" value={formData.sportCards.cycling?.ftp} onValueChange={(e) => updateCardData('cycling', 'ftp', e.value ?? null)} className="w-full" suffix=" W" />
                                    <label htmlFor="cyc_ftp">FTP功率</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="cyc_maxpower" value={formData.sportCards.cycling?.maxPower} onValueChange={(e) => updateCardData('cycling', 'maxPower', e.value ?? null)} className="w-full" suffix=" W" />
                                    <label htmlFor="cyc_maxpower">最大功率</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber id="cyc_distance" value={formData.sportCards.cycling?.maxDistance} onValueChange={(e) => updateCardData('cycling', 'maxDistance', e.value ?? null)} className="w-full" suffix=" km" />
                                    <label htmlFor="cyc_distance">最长单骑</label>
                                </FloatLabel>
                            </div>
                        </div>
                    )}

                    {/* 没有选择任何卡片的提示 */}
                    {formData.sportCards.activeCards.length === 0 && (
                        <div className="text-center py-6 text-surface-400">
                            <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">点击上方卡片添加您的运动数据</p>
                            <p className="text-xs mt-1">（可跳过此步骤）</p>
                        </div>
                    )}

                    <div className="flex gap-3 sticky bottom-0 bg-white pt-4 pb-2">
                        <Button
                            label="上一步"
                            icon="pi pi-arrow-left"
                            onClick={handleBack}
                            outlined
                            className="flex-1"
                        />
                        <Button
                            label="完成"
                            icon="pi pi-check"
                            iconPos="right"
                            onClick={handleSubmit}
                            loading={loading}
                            className="flex-1"
                        />
                    </div>
                </div>
            )}
        </Dialog>
    );
}
