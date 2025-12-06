'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { FloatLabel } from 'primereact/floatlabel';
import { ProgressBar } from 'primereact/progressbar';
import { useToastContext } from '@/context/ToastContext';
import { studentService } from '@/app/service/studentService';
import { Dumbbell, User, Activity } from 'lucide-react';

// 运动数据卡片类型定义
interface PowerliftingData {
    squat: number | null;
    bench: number | null;
    deadlift: number | null;
}

interface BodybuildingData {
    chest: number | null;
    arm: number | null;
    waist: number | null;
    hip: number | null;
    bodyfat: number | null;
}

interface FitnessData {
    pullups: number | null;
    pushups: number | null;
    plank: number | null;
    restingHR: number | null;
}

interface SportCards {
    activeCards: string[];
    powerlifting?: PowerliftingData;
    bodybuilding?: BodybuildingData;
    fitness?: FitnessData;
}

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

const CARD_TYPES = [
    { key: 'powerlifting', label: '力量举', icon: Dumbbell, color: 'bg-orange-100 text-orange-600', active: 'bg-orange-500/20 border-orange-500' },
    { key: 'bodybuilding', label: '健美/形体', icon: User, color: 'bg-purple-100 text-purple-600', active: 'bg-purple-500/20 border-purple-500' },
    { key: 'fitness', label: '一般体能', icon: Activity, color: 'bg-green-100 text-green-600', active: 'bg-green-500/20 border-green-500' },
];

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
    const { showToast } = useToastContext();
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
        sportCards: {
            activeCards: [],
            powerlifting: { squat: null, bench: null, deadlift: null },
            bodybuilding: { chest: null, arm: null, waist: null, hip: null, bodyfat: null },
            fitness: { pullups: null, pushups: null, plank: null, restingHR: null },
        },
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

    // 更新卡片数据
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

    // 下一步
    const handleNext = () => {
        if (step === 1 && !validateStep1()) return;
        setStep(step + 1);
    };

    // 上一步
    const handleBack = () => {
        setStep(step - 1);
    };

    // 提交表单
    const handleSubmit = async () => {
        setLoading(true);
        try {
            console.log('Submitting onboarding data:', {
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

            console.log('Onboarding API result:', result);

            if (result) {
                showToast({ severity: 'success', summary: '档案设置完成！' });
                // 先关闭模态框
                onClose();
                // 延迟后刷新整个页面以确保 session 更新
                setTimeout(() => {
                    window.location.reload();
                }, 300);
            } else {
                console.error('API returned null/undefined result');
                showToast({ severity: 'error', summary: '保存失败', detail: 'API未返回结果，请查看浏览器控制台' });
            }
        } catch (error: any) {
            console.error('Onboarding submission error:', error);
            const errorMessage = error?.response?.data?.message || error?.message || '未知错误';
            showToast({ 
                severity: 'error', 
                summary: '保存失败',
                detail: errorMessage,
                life: 5000
            });
        } finally {
            setLoading(false);
        }
    };

    // 计算力量举总和
    const getPowerliftingTotal = () => {
        const pl = formData.sportCards.powerlifting;
        if (!pl) return 0;
        return (pl.squat || 0) + (pl.bench || 0) + (pl.deadlift || 0);
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
            style={{ width: '650px', maxWidth: '90vw' }}
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
                        {/* 昵称 */}
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

                        {/* 健身目标 */}
                        <Dropdown
                            id="fitnessGoal"
                            value={formData.fitnessGoal}
                            options={FITNESS_GOAL_OPTIONS}
                            onChange={(e) => setFormData({ ...formData, fitnessGoal: e.value })}
                            className="w-full mb-2"
                            placeholder="健身目标 *"
                        />

                        {/* 健身水平 */}
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
                    <p className="text-sm text-surface-500">选择您关注的运动类型，填写相关数据（可多选，选填）</p>

                    {/* 卡片选择器 */}
                    <div className="grid grid-cols-3 gap-3">
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

                    {/* 力量举卡片表单 */}
                    {formData.sportCards.activeCards.includes('powerlifting') && (
                        <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                            <h4 className="text-sm font-semibold text-orange-700 mb-3 flex items-center gap-2">
                                <Dumbbell className="w-4 h-4" />
                                力量举数据
                            </h4>
                            <div className="grid grid-cols-2 gap-3 pt-4">
                                <FloatLabel className='mb-4'>
                                    <InputNumber
                                        id="squat"
                                        value={formData.sportCards.powerlifting?.squat}
                                        onValueChange={(e) => updateCardData('powerlifting', 'squat', e.value ?? null)}
                                        className="w-full"
                                        suffix=" kg"
                                    />
                                    <label htmlFor="squat">深蹲 1RM</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber
                                        id="bench"
                                        value={formData.sportCards.powerlifting?.bench}
                                        onValueChange={(e) => updateCardData('powerlifting', 'bench', e.value ?? null)}
                                        className="w-full"
                                        suffix=" kg"
                                    />
                                    <label htmlFor="bench">卧推 1RM</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber
                                        id="deadlift"
                                        value={formData.sportCards.powerlifting?.deadlift}
                                        onValueChange={(e) => updateCardData('powerlifting', 'deadlift', e.value ?? null)}
                                        className="w-full"
                                        suffix=" kg"
                                    />
                                    <label htmlFor="deadlift">硬拉 1RM</label>
                                </FloatLabel>
                                <div className="flex items-center justify-center bg-orange-100 rounded-lg p-2 mb-4">
                                    <span className="text-sm text-orange-700">
                                        总和: <strong>{getPowerliftingTotal()} kg</strong>
                                    </span>
                                </div>
                            </div>
                            <div className="mt-2 text-xs text-orange-600">
                                注：1RM（一次最大重复）是指您以标准的动作，在不用借力的情况下，竭尽全力只能完成一次动作的最大重量。
                            </div>
                        </div>
                    )}

                    {/* 健美卡片表单 */}
                    {formData.sportCards.activeCards.includes('bodybuilding') && (
                        <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                            <h4 className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-2">
                                <User className="w-4 h-4" />
                                健美/形体数据
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                                <FloatLabel className='mb-4'>
                                    <InputNumber
                                        id="chest"
                                        value={formData.sportCards.bodybuilding?.chest}
                                        onValueChange={(e) => updateCardData('bodybuilding', 'chest', e.value ?? null)}
                                        className="w-full"
                                        suffix=" cm"
                                    />
                                    <label htmlFor="chest">胸围</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber
                                        id="arm"
                                        value={formData.sportCards.bodybuilding?.arm}
                                        onValueChange={(e) => updateCardData('bodybuilding', 'arm', e.value ?? null)}
                                        className="w-full"
                                        suffix=" cm"
                                    />
                                    <label htmlFor="arm">臂围</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber
                                        id="waist"
                                        value={formData.sportCards.bodybuilding?.waist}
                                        onValueChange={(e) => updateCardData('bodybuilding', 'waist', e.value ?? null)}
                                        className="w-full"
                                        suffix=" cm"
                                    />
                                    <label htmlFor="waist">腰围</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber
                                        id="hip"
                                        value={formData.sportCards.bodybuilding?.hip}
                                        onValueChange={(e) => updateCardData('bodybuilding', 'hip', e.value ?? null)}
                                        className="w-full"
                                        suffix=" cm"
                                    />
                                    <label htmlFor="hip">臀围</label>
                                </FloatLabel>
                                <FloatLabel className="col-span-2">
                                    <InputNumber
                                        id="bodyfat"
                                        value={formData.sportCards.bodybuilding?.bodyfat}
                                        onValueChange={(e) => updateCardData('bodybuilding', 'bodyfat', e.value ?? null)}
                                        className="w-full"
                                        suffix=" %"
                                        minFractionDigits={1}
                                        maxFractionDigits={1}
                                    />
                                    <label htmlFor="bodyfat">体脂率（选填）</label>
                                </FloatLabel>
                            </div>
                        </div>
                    )}

                    {/* 体能卡片表单 */}
                    {formData.sportCards.activeCards.includes('fitness') && (
                        <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                            <h4 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
                                <Activity className="w-4 h-4" />
                                一般体能数据
                            </h4>
                            <div className="grid grid-cols-2 gap-3 pt-4">
                                <FloatLabel className='mb-4'>
                                    <InputNumber
                                        id="pullups"
                                        value={formData.sportCards.fitness?.pullups}
                                        onValueChange={(e) => updateCardData('fitness', 'pullups', e.value ?? null)}
                                        className="w-full"
                                        suffix=" 次"
                                    />
                                    <label htmlFor="pullups">引体向上</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber
                                        id="pushups"
                                        value={formData.sportCards.fitness?.pushups}
                                        onValueChange={(e) => updateCardData('fitness', 'pushups', e.value ?? null)}
                                        className="w-full"
                                        suffix=" 次"
                                    />
                                    <label htmlFor="pushups">俯卧撑</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber
                                        id="plank"
                                        value={formData.sportCards.fitness?.plank}
                                        onValueChange={(e) => updateCardData('fitness', 'plank', e.value ?? null)}
                                        className="w-full"
                                        suffix=" 秒"
                                    />
                                    <label htmlFor="plank">平板支撑</label>
                                </FloatLabel>
                                <FloatLabel className='mb-4'>
                                    <InputNumber
                                        id="restingHR"
                                        value={formData.sportCards.fitness?.restingHR}
                                        onValueChange={(e) => updateCardData('fitness', 'restingHR', e.value ?? null)}
                                        className="w-full"
                                        suffix=" bpm"
                                    />
                                    <label htmlFor="restingHR">静态心率</label>
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
