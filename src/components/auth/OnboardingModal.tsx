'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { ProgressBar } from 'primereact/progressbar';
import { Slider } from 'primereact/slider';
import { useToastContext } from '@/context/ToastContext';
import { studentService } from '@/app/service/studentService';
import { useOnboardingModal } from './OnboardingModalContext';
import type { UserProfilesRow } from '@/types';

interface OnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialProfile?: Partial<UserProfilesRow> | null;
}

interface OnboardingFormData {
    nickname: string;
    gender: string;
    height: number;
    weight: number;
    fitnessGoal: string;
    fitnessLevel: string;
    equipments: string[];
    sessionDuration: number;
}

/* ─── 选项常量 ─── */

const GENDER_OPTIONS = [
    { label: '👨 男', value: 'male' },
    { label: '👩 女', value: 'female' },
];

const FITNESS_GOAL_OPTIONS = [
    { emoji: '🔥', label: '减脂塑形', desc: '减掉多余脂肪，塑造身体线条', value: '减脂' },
    { emoji: '💪', label: '增肌强身', desc: '增加肌肉量，提升力量感', value: '增肌' },
    { emoji: '🏋️', label: '力量提升', desc: '提升绝对力量和运动表现', value: '力量提升' },
    { emoji: '❤️', label: '体能改善', desc: '增强心肺耐力和整体体能', value: '体能改善' },
    { emoji: '🧘', label: '体态矫正', desc: '改善圆肩驼背、骨盆前倾等', value: '体态矫正' },
    { emoji: '🏃', label: '运动恢复', desc: '从伤病或长期不运动中恢复', value: '运动恢复' },
    { emoji: '⚡', label: '综合体适能', desc: '全面均衡提升身体各项能力', value: '综合体适能' },
    { emoji: '🧘‍♀️', label: '灵活柔韧', desc: '提高关节活动度和柔韧性', value: '灵活柔韧' },
];

const FITNESS_LEVEL_OPTIONS = [
    { label: '零基础', desc: '从未系统训练过', value: 'beginner', wifiLevel: 1 },
    { label: '入门', desc: '偶尔锻炼，了解基础动作', value: 'novice', wifiLevel: 2 },
    { label: '进阶', desc: '系统训练 1 年以上', value: 'intermediate', wifiLevel: 3 },
    { label: '高阶', desc: '多年训练，可自主制定计划', value: 'advanced', wifiLevel: 4 },
    { label: '精英 / 职业', desc: '健身教练、运动员或竞技水平', value: 'elite', wifiLevel: 5 },
];

const EQUIPMENT_OPTIONS = [
    { emoji: '🤲', label: '徒手' },
    { emoji: '🏋️', label: '哑铃' },
    { emoji: '🏗️', label: '杠铃' },
    { emoji: '🪢', label: '拉力器/弹力带' },
    { emoji: '🏢', label: '固定器械' },
    { emoji: '⚫', label: '壶铃' },
];

const DURATION_OPTIONS = [
    { label: '15 分钟', value: 15 },
    { label: '20 分钟', value: 20 },
    { label: '30 分钟', value: 30 },
    { label: '45 分钟', value: 45 },
    { label: '60 分钟', value: 60 },
];

/* ─── 身高体重快选 ─── */
const FITNESS_GOAL_SEPARATOR = '\u3001';

function normalizeFitnessGoals(value: unknown): string[] {
    const rawValues = Array.isArray(value)
        ? value
        : String(value || '').split(/[,\u3001\uff0c]/);
    return Array.from(
        new Set(
            rawValues
                .map((item) => String(item || '').trim())
                .filter(Boolean),
        ),
    );
}

function formatFitnessGoals(goals: string[]): string {
    return normalizeFitnessGoals(goals).join(FITNESS_GOAL_SEPARATOR);
}

const HEIGHT_PRESETS = [150, 155, 160, 165, 170, 175, 180, 185, 190];
const WEIGHT_PRESETS = [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];

export default function OnboardingModal({ isOpen, onClose, initialProfile }: OnboardingModalProps) {
    const router = useRouter();
    const { data: session, update: updateSession } = useSession();
    const { showToast } = useToastContext();
    const { suppressOnboardingModalOnce } = useOnboardingModal();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<OnboardingFormData>({
        nickname: '',
        gender: '',
        height: 170,
        weight: 65,
        fitnessGoal: '',
        fitnessLevel: '',
        equipments: [],
        sessionDuration: 30,
    });

    // 根据传入的已有 profile 预填表单（只在首次打开或 profile 变化时预填）
    useEffect(() => {
        if (!isOpen || !initialProfile) return;
        setFormData((prev) => ({
            ...prev,
            nickname: initialProfile.nickname?.trim() || prev.nickname,
            gender: initialProfile.gender || prev.gender,
            height: (initialProfile.height && initialProfile.height > 0) ? initialProfile.height : prev.height,
            weight: (initialProfile.weight && initialProfile.weight > 0) ? initialProfile.weight : prev.weight,
            fitnessGoal: initialProfile.fitness_goal || prev.fitnessGoal,
            fitnessLevel: initialProfile.fitness_level || prev.fitnessLevel,
        }));
        setStep(1);
    }, [isOpen, initialProfile]);

    const totalSteps = 3;
    const progressValue = useMemo(() => (step / totalSteps) * 100, [step]);
    const selectedFitnessGoals = useMemo(
        () => normalizeFitnessGoals(formData.fitnessGoal),
        [formData.fitnessGoal],
    );

    const toggleFitnessGoal = (value: string) => {
        setFormData((prev) => {
            const current = normalizeFitnessGoals(prev.fitnessGoal);
            const next = current.includes(value)
                ? current.filter((item) => item !== value)
                : [...current, value];
            return { ...prev, fitnessGoal: formatFitnessGoals(next) };
        });
    };

    const toggleEquipment = (value: string) => {
        setFormData((prev) => {
            const exists = prev.equipments.includes(value);
            return {
                ...prev,
                equipments: exists
                    ? prev.equipments.filter((v) => v !== value)
                    : [...prev.equipments, value],
            };
        });
    };

    const validateStep1 = () => {
        if (!formData.nickname.trim()) {
            showToast({ severity: 'warn', summary: '请填写昵称' });
            return false;
        }
        if (!formData.gender) {
            showToast({ severity: 'warn', summary: '请选择性别' });
            return false;
        }
        if (formData.height < 100 || formData.height > 250) {
            showToast({ severity: 'warn', summary: '请调整到合理身高（100-250cm）' });
            return false;
        }
        if (formData.weight < 30 || formData.weight > 200) {
            showToast({ severity: 'warn', summary: '请调整到合理体重（30-200kg）' });
            return false;
        }
        return true;
    };

    const validateStep2 = () => {
        if (selectedFitnessGoals.length === 0) {
            showToast({ severity: 'warn', summary: '请选择一个健身目标' });
            return false;
        }
        if (!formData.fitnessLevel) {
            showToast({ severity: 'warn', summary: '请选择训练水平' });
            return false;
        }
        return true;
    };

    const handleSubmit = async () => {
        if (!session?.user?.id) {
            showToast({ severity: 'error', summary: '用户状态异常，请重新登录' });
            return;
        }

        setLoading(true);
        try {
            const profileResult = await studentService.updateProfile({
                nickname: formData.nickname.trim(),
                gender: formData.gender,
                height: formData.height,
                weight: formData.weight,
                fitness_goal: formData.fitnessGoal,
                fitness_level: formData.fitnessLevel,
                onboarding_completed: true,
            });

            if (!profileResult) {
                throw new Error('档案保存失败');
            }

            // 以问卷 answers 保存"兴趣/器械/单次时长"，供后续推荐与 AI 参数使用
            try {
                await studentService.submitOnboarding({
                    userId: session.user.id,
                    answers: {
                        flow_version: 'v2_minimal_first_workout',
                        fitness_goals: selectedFitnessGoals,
                        equipment: formData.equipments,
                        session_duration: formData.sessionDuration,
                    },
                    baseline_video_urls: [],
                });
            } catch (onboardingErr) {
                console.warn('[OnboardingModal] submitOnboarding failed, continue:', onboardingErr);
            }

            suppressOnboardingModalOnce();
            try {
                await updateSession();
            } catch (sessionErr) {
                console.warn('[OnboardingModal] updateSession failed:', sessionErr);
            }

            showToast({ severity: 'success', summary: '档案已完成，开始第一次训练吧 🎉' });
            onClose();
            router.replace('/impromptu-training?from=onboarding');
        } catch (error: any) {
            const message = error?.response?.data?.message || error?.message || '保存失败，请稍后重试';
            showToast({ severity: 'error', summary: '保存失败', detail: message });
        } finally {
            setLoading(false);
        }
    };

    /* ─── 通用卡片选择按钮 ─── */
    const CardButton = ({ selected, onClick, children, className = '' }: {
        selected: boolean;
        onClick: () => void;
        children: React.ReactNode;
        className?: string;
    }) => (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-2xl border-2 transition-all duration-200 active:scale-[0.97] ${
                selected
                    ? 'border-primary-400 bg-primary-50 shadow-sm'
                    : 'border-surface-200 bg-surface-0 hover:border-surface-300'
            } ${className}`}
        >
            {children}
        </button>
    );

    const stepLabels = ['基础信息', '健身目标', '训练条件'];

    return (
        <Dialog
            header={(
                <div className="flex items-center gap-3">
                    <img src="/favicon.jpg" alt="CoachLink Logo" className="h-10 rounded-lg" />
                    <div>
                        <h2 className="text-lg font-bold">完善基础档案</h2>
                        <p className="text-xs text-surface-500">完成后即刻开启第一次训练</p>
                    </div>
                </div>
            )}
            visible={isOpen}
            onHide={onClose}
            modal
            blockScroll
            closable={false}
            className="w-full max-w-lg mx-4"
            style={{ maxHeight: '90vh' }}
            contentClassName="overflow-y-auto"
            footer={(
                <div className="w-full flex gap-2">
                    {step > 1 && (
                        <Button
                            label="上一步"
                            icon="pi pi-chevron-left"
                            onClick={() => setStep(step - 1)}
                            className="flex-1"
                            outlined
                        />
                    )}
                    {step < totalSteps ? (
                        <Button
                            label="下一步"
                            icon="pi pi-arrow-right"
                            iconPos="right"
                            onClick={() => {
                                if (step === 1 && validateStep1()) setStep(2);
                                else if (step === 2 && validateStep2()) setStep(3);
                            }}
                            className="flex-1"
                        />
                    ) : (
                        <Button
                            label="🚀 开始第一次训练"
                            onClick={handleSubmit}
                            loading={loading}
                            className="flex-1 font-bold"
                        />
                    )}
                </div>
            )}
        >
            {/* 进度条 */}
            <div className="mb-5">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-xs font-bold text-primary-500">第 {step} 步 / 共 {totalSteps} 步</span>
                    <span className="text-sm text-surface-600">{stepLabels[step - 1]}</span>
                </div>
                <ProgressBar value={progressValue} showValue={false} className="h-1.5" />
            </div>

            {/* ═══════ Step 1: 基础信息（昵称、性别、身高、体重） ═══════ */}
            {step === 1 && (
                <div className="space-y-5">
                    {/* 昵称 */}
                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-2">昵称</label>
                        <InputText
                            value={formData.nickname}
                            onChange={(e) => setFormData((prev) => ({ ...prev, nickname: e.target.value }))}
                            placeholder="给自己取个名字吧"
                            className="w-full text-base"
                        />
                    </div>

                    {/* 性别 - 大卡片按钮 */}
                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-2">性别</label>
                        <div className="grid grid-cols-2 gap-3">
                            {GENDER_OPTIONS.map((opt) => (
                                <CardButton
                                    key={opt.value}
                                    selected={formData.gender === opt.value}
                                    onClick={() => setFormData((prev) => ({ ...prev, gender: opt.value }))}
                                    className="py-4 text-center text-lg"
                                >
                                    {opt.label}
                                </CardButton>
                            ))}
                        </div>
                    </div>

                    {/* 身高 - 滑块 + 快选 */}
                    <div>
                        <div className="flex justify-between items-baseline mb-2">
                            <label className="text-sm font-medium text-surface-700">身高</label>
                            <span className="text-xl font-bold text-primary-600">{formData.height} <span className="text-sm font-normal text-surface-500">cm</span></span>
                        </div>
                        <Slider
                            value={formData.height}
                            onChange={(e) => setFormData((prev) => ({ ...prev, height: e.value as number }))}
                            min={140}
                            max={210}
                            step={1}
                            className="w-full mb-3"
                        />
                        <div className="flex flex-wrap gap-1.5">
                            {HEIGHT_PRESETS.map((h) => (
                                <button
                                    key={h}
                                    type="button"
                                    onClick={() => setFormData((prev) => ({ ...prev, height: h }))}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                        formData.height === h
                                            ? 'bg-primary-500 text-white'
                                            : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                                    }`}
                                >
                                    {h}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 体重 - 滑块 + 快选 */}
                    <div>
                        <div className="flex justify-between items-baseline mb-2">
                            <label className="text-sm font-medium text-surface-700">体重</label>
                            <span className="text-xl font-bold text-primary-600">{formData.weight} <span className="text-sm font-normal text-surface-500">kg</span></span>
                        </div>
                        <Slider
                            value={formData.weight}
                            onChange={(e) => setFormData((prev) => ({ ...prev, weight: e.value as number }))}
                            min={30}
                            max={150}
                            step={1}
                            className="w-full mb-3"
                        />
                        <div className="flex flex-wrap gap-1.5">
                            {WEIGHT_PRESETS.map((w) => (
                                <button
                                    key={w}
                                    type="button"
                                    onClick={() => setFormData((prev) => ({ ...prev, weight: w }))}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                        formData.weight === w
                                            ? 'bg-primary-500 text-white'
                                            : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                                    }`}
                                >
                                    {w}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════ Step 2: 健身目标 + 训练水平 ═══════ */}
            {step === 2 && (
                <div className="space-y-6">
                    {/* 健身目标 - 丰富卡片 */}
                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-3">你的健身目标是？</label>
                        <div className="grid grid-cols-2 gap-2.5">
                            {FITNESS_GOAL_OPTIONS.map((opt) => {
                                const active = selectedFitnessGoals.includes(opt.value);
                                return (
                                    <CardButton
                                        key={opt.value}
                                        selected={active}
                                        onClick={() => toggleFitnessGoal(opt.value)}
                                        className="p-3 text-left"
                                    >
                                        <div className="text-xl mb-1">{opt.emoji}</div>
                                        <div className="text-sm font-semibold text-surface-800">{opt.label}</div>
                                        <div className="text-xs text-surface-500 mt-0.5 leading-relaxed">{opt.desc}</div>
                                    </CardButton>
                                );
                            })}
                        </div>
                    </div>

                    {/* 训练水平 - 大卡片 */}
                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-3">你的训练经验？</label>
                        <div className="space-y-2.5">
                            {FITNESS_LEVEL_OPTIONS.map((opt) => (
                                <CardButton
                                    key={opt.value}
                                    selected={formData.fitnessLevel === opt.value}
                                    onClick={() => setFormData((prev) => ({ ...prev, fitnessLevel: opt.value }))}
                                    className="w-full p-4 flex items-center gap-3 text-left"
                                >
                                    <svg width="40" height="34" viewBox="0 0 48 40" className="flex-shrink-0">
                                        <path d="M 4 36 Q 24 16 44 36" stroke={opt.wifiLevel >= 5 && formData.fitnessLevel === opt.value ? '#CF6D4E' : '#e2e8f0'} fill="none" strokeWidth="3" strokeLinecap="round"/>
                                        <path d="M 8 30 Q 24 14 40 30" stroke={opt.wifiLevel >= 4 && formData.fitnessLevel === opt.value ? '#CF6D4E' : '#e2e8f0'} fill="none" strokeWidth="3" strokeLinecap="round"/>
                                        <path d="M 12 24 Q 24 12 36 24" stroke={opt.wifiLevel >= 3 && formData.fitnessLevel === opt.value ? '#CF6D4E' : '#e2e8f0'} fill="none" strokeWidth="3" strokeLinecap="round"/>
                                        <path d="M 16 18 Q 24 10 32 18" stroke={opt.wifiLevel >= 2 && formData.fitnessLevel === opt.value ? '#CF6D4E' : '#e2e8f0'} fill="none" strokeWidth="3" strokeLinecap="round"/>
                                        <path d="M 20 12 Q 24 8 28 12" stroke={opt.wifiLevel >= 1 && formData.fitnessLevel === opt.value ? '#CF6D4E' : '#e2e8f0'} fill="none" strokeWidth="3" strokeLinecap="round"/>
                                    </svg>
                                    <div>
                                        <div className="text-sm font-semibold text-surface-800">{opt.label}</div>
                                        <div className="text-xs text-surface-500">{opt.desc}</div>
                                    </div>
                                </CardButton>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════ Step 3: 训练条件 ═══════ */}
            {step === 3 && (
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-2">可用训练器械（可多选）</label>
                        <div className="grid grid-cols-2 gap-2">
                            {EQUIPMENT_OPTIONS.map((opt) => {
                                const active = formData.equipments.includes(opt.label);
                                return (
                                    <CardButton
                                        key={opt.label}
                                        selected={active}
                                        onClick={() => toggleEquipment(opt.label)}
                                        className="py-3 px-3 text-center"
                                    >
                                        <span className="text-lg">{opt.emoji}</span>
                                        <span className="ml-1.5 text-sm">{opt.label}</span>
                                    </CardButton>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-2">每次可投入时间</label>
                        <div className="flex flex-wrap gap-2">
                            {DURATION_OPTIONS.map((opt) => (
                                <CardButton
                                    key={opt.value}
                                    selected={formData.sessionDuration === opt.value}
                                    onClick={() => setFormData((prev) => ({ ...prev, sessionDuration: opt.value }))}
                                    className="px-4 py-2.5 text-sm font-medium"
                                >
                                    {opt.label}
                                </CardButton>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </Dialog>
    );
}
