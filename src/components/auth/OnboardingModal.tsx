'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { FloatLabel } from 'primereact/floatlabel';
import { ProgressBar } from 'primereact/progressbar';
import { useToastContext } from '@/context/ToastContext';
import { studentService } from '@/app/service/studentService';
import { Dumbbell, User, Activity, Bike, Footprints, CalendarIcon } from 'lucide-react';
import { SportCards } from '@/types/sportCards';
import { getEmptySportCards, getPowerliftingTotal, getStreetliftingTotal, getTotalWeight, getWeightliftingTotal } from '@/lib/sportsCollections';
import { useOnboardingModal } from './OnboardingModalContext';
import { useSession } from 'next-auth/react';
import { Calendar } from 'primereact/calendar';
import { addLocale, locale } from "primereact/api";
import { AeroInputNumber } from '../AeroInputNumber';
import { AeroTimePicker } from '../AeroTimePicker';
import { showTotalWeight, SportTypes, typicalActionMaps } from '@/lib/sportsCollections';

addLocale('zh-CN', {
    firstDayOfWeek: 1,
    dayNames: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
    dayNamesShort: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
    dayNamesMin: ['日', '一', '二', '三', '四', '五', '六'],
    monthNames: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
    monthNamesShort: ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'],
    today: '今天',
    clear: '清除'
});


interface FormData {
    nickname: string;
    birthday: Date | null;
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
        birthday: null,
        age: null,
        gender: '',
        height: null,
        weight: null,
        lifestyle: '',
        fitnessGoal: '',
        fitnessLevel: '',
        sportCards: getEmptySportCards(),
    });

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [formData.sportCards.activeCards.length]);

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

    const calculateAge = (birthDate: Date | null): number | null => {
        if (!birthDate) return null;

        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        // 如果还没到今年的生日月份，或者到了生日月份但还没到生日当天，则年龄减一
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        return age;
    };

    // 验证第一步
    const validateStep1 = () => {
        if (!formData.nickname.trim()) {
            showToast({ severity: 'warn', summary: '请填写昵称' });
            return false;
        }
        if (!formData.birthday) {
            showToast({ severity: 'warn', summary: '请选择出生日期' });
            return false;
        }

        // 计算出年龄
        formData.age = calculateAge(formData.birthday);

        if (!formData.age || formData.age < 10 || formData.age > 120) {
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
                birth_date: formData.birthday,
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
            style={{ width: '640px' }}
            footer={
                <div className="w-full">
                    {step === 1 && (
                        /* 环节一底部：使用 w-full 确保在移动端拥有极佳的触控面积 */
                        <div className="flex pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500 gap-12">
                            <div className='flex-1 w-20'></div>
                            <Button
                                label="下一步"
                                icon="pi pi-arrow-right"
                                iconPos="right"
                                onClick={handleNext}
                                className="flex-1 h-14 rounded-2xl bg-surface-900 border-none font-black tracking-tight text-white active:scale-[0.98] transition-all shadow-xl shadow-surface-200"
                            />
                        </div>
                    )}

                    {step === 2 && (
                        /* 环节一底部：使用 w-full 确保在移动端拥有极佳的触控面积 */
                        <div className="pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500 flex">
                            <Button
                                label="上一步"
                                icon="pi pi-chevron-left"
                                onClick={handleBack}
                                className="flex-1 h-14 rounded-2xl bg-surface-100/50 border-none text-surface-600 font-bold active:scale-95 transition-all"
                            />
                            <Button
                                label="下一步"
                                icon="pi pi-arrow-right"
                                iconPos="right"
                                onClick={handleNext}
                                className="flex-1 h-14 rounded-2xl bg-surface-900 border-none font-black tracking-tight text-white active:scale-[0.98] transition-all shadow-xl shadow-surface-200"
                            />
                        </div>
                    )}

                    {step === 3 && (
                        /* 环节二底部：通过 flex-1 和 flex-[2] 实现主次动作的视觉权重分配 */
                        <div className="flex items-center gap-3 pt-6 border-t border-surface-100/50 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <Button
                                label="返回"
                                icon="pi pi-chevron-left"
                                onClick={handleBack}
                                className="flex-1 h-14 rounded-2xl bg-surface-100/50 border-none text-surface-600 font-bold active:scale-95 transition-all"
                            />
                            <Button
                                label="开启数字化训练"
                                icon="pi pi-bolt"
                                onClick={handleSubmit}
                                loading={loading}
                                // 使用你定义的主题色 #F28631 或 primary-500
                                className="flex-[2.5] h-14 rounded-2xl bg-[#F28631] border-none text-white font-black tracking-tight active:scale-[0.98] transition-all shadow-xl shadow-orange-200/50"
                            />
                        </div>
                    )}
                </div>
            }
            modal
            blockScroll
            closable={false}
            pt={{
                root: {
                    className: 'shadow-none border-none bg-transparent min-h-screen md:min-h-[fit-content]'
                },
                header: {
                    // 修改头部容器样式：增加内边距、背景色、去掉默认下划线
                    className: 'p-8 pb-4 border-none bg-surface md:rounded-t-[24px] rounded-t-none'
                },
                content: {
                    className: 'text-xl font-black tracking-tight'
                },
                footer: {
                    className: 'md:rounded-b-[24px] rounded-b-none'
                }
            }}
        >
            {/* 进度导航：采用非线性平滑过渡 */}
            <div className="mb-10 px-1">
                <div className="flex justify-between items-end mb-3">
                    <span className="text-[10px] font-black text-primary-500 uppercase tracking-[0.3em]">
                        第 {step} 步 / 共 2 步
                    </span>
                    <span className="text-sm font-black text-surface-900 tracking-tight">
                        {step === 1 ? '基本信息' : step === 2 ? '练习领域' : '历史成绩'}
                    </span>
                </div>
                <ProgressBar value={(step / 3) * 100} showValue={false} className="h-1.5 bg-surface-50" color="#F28631" />
            </div>

            {/* 环节一：基础信息采集 */}
            {step === 1 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-8">
                        {/* 昵称输入：信息约束设计 */}
                        <div className="col-span-2">
                            <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest mb-2 block px-1">显示昵称</label>
                            <InputText
                                value={formData.nickname}
                                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                                className="w-full h-12 rounded-xl border-surface-100 bg-surface-50/30 focus:bg-surface transition-all font-bold"
                                placeholder="如何称呼您？"
                            />
                        </div>

                        {/* 出���日期：精确数据维度 */}
                        <div>
                            <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest mb-2 block px-1">出生日期</label>
                            <div className="relative group">
                                <Calendar
                                    value={formData.birthday}
                                    onChange={(e) => setFormData({ ...formData, birthday: e.value as Date })}
                                    className="w-full h-12 aero-calendar"
                                    inputClassName="rounded-xl border-surface-100 bg-surface-50/30 font-bold"
                                    placeholder="选择您的生日"
                                    showIcon={false}
                                    maxDate={new Date()}
                                    locale="zh-CN"
                                />
                                <CalendarIcon className="absolute right-4 top-3.5 w-5 h-5 text-surface-300 pointer-events-none group-hover:text-primary-500 transition-colors" />
                            </div>
                        </div>

                        {/* 生理性别：低饱和功能色下拉框 */}
                        <div>
                            <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest mb-2 block px-1">性别</label>
                            <Dropdown
                                value={formData.gender}
                                options={GENDER_OPTIONS}
                                onChange={(e) => setFormData({ ...formData, gender: e.value })}
                                className="w-full h-12 rounded-xl border-surface-100 bg-surface-50/30 font-bold"
                                placeholder="请选择"
                            />
                        </div>

                        {/* 核心体征指标 */}
                        <div>
                            <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest mb-2 block px-1">身高 (CM)</label>
                            <AeroInputNumber
                                value={formData.height}
                                onValueChange={(e) => setFormData({ ...formData, height: e.value ?? null })}
                                className="w-full h-12"
                                inputClassName="rounded-xl border-surface-100 bg-surface-50/30 font-bold"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest mb-2 block px-1">体重 (KG)</label>
                            <AeroInputNumber
                                value={formData.weight}
                                onValueChange={(e) => setFormData({ ...formData, weight: e.value ?? null })}
                                className="w-full h-12"
                                inputClassName="rounded-xl border-surface-100 bg-surface-50/30 font-bold"
                            />
                        </div>

                        {/* --- 健身目标 --- */}
                        <div>
                            <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest mb-2 block px-1">健身目标</label>
                            <Dropdown
                                value={formData.fitnessGoal}
                                options={FITNESS_GOAL_OPTIONS}
                                onChange={(e) => setFormData({ ...formData, fitnessGoal: e.value })}
                                className="w-full h-12 rounded-xl border-surface-100 bg-surface-50/30 font-bold"
                                placeholder="请选择目标"
                            />
                        </div>

                        {/* --- 当前水平 --- */}
                        <div>
                            <label className="text-[10px] font-black text-surface-400 uppercase tracking-widest mb-2 block px-1">运动水平</label>
                            <Dropdown
                                value={formData.fitnessLevel}
                                options={FITNESS_LEVEL_OPTIONS}
                                onChange={(e) => setFormData({ ...formData, fitnessLevel: e.value })}
                                className="w-full h-12 rounded-xl border-surface-100 bg-surface-50/30 font-bold"
                                placeholder="请选择水平"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* 环节二：多维度运动卡片配置 */}
            {step === 2 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className='text-xl'>选择您感兴趣或正在练习的领域</div>
                    {/* 运动磁贴选择器：利用视觉本能引导 */}
                    <div className="grid grid-cols-2 gap-3">
                        {SportTypes.map((card) => {
                            const Icon = card.icon;
                            const isActive = formData.sportCards.activeCards.includes(card.key);
                            return (
                                <div
                                    key={card.key}
                                    onClick={() => toggleCard(card.key)}
                                    className={`
                                        group cursor-pointer relative overflow-hidden transition-all duration-300
                                        px-2 py-3 rounded-[16px] border text-center active:scale-[0.94]
                                        ${isActive
                                            ? `${card.active} shadow-sm shadow-current/5`
                                            : 'border-surface-200 bg-surface-50/50 hover:bg-surface hover:border-surface-200'
                                        }
                                    `}
                                >
                                    {/* 状态指示：改为更加细腻的右上角呼吸点 */}
                                    {isActive && (
                                        <div className="absolute top-2 right-2 flex items-center justify-center">
                                            <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style={{ color: card.color }} />
                                        </div>
                                    )}

                                    <div className="flex flex-col items-center gap-2">
                                        {/* 图标容器：缩小尺寸，强化背景色对比 */}
                                        <div className={`
                                            w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 
                                            group-hover:scale-110 group-active:rotate-12
                                            ${card.bg} ${card.color}
                                        `}>
                                            <Icon size={16} strokeWidth={2.5} />
                                        </div>

                                        <span className="text-[10px] font-black text-surface-700 tracking-tighter leading-none">
                                            {card.label}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>


            )}

            {step === 3 && (
                <div>
                    {/* 动态表单容器：修复颜色变量与渲染逻辑 */}
                    <div
                        ref={scrollContainerRef}
                        className="overflow-y-auto pr-2 space-y-3 py-2"
                    >
                        {formData.sportCards.activeCards.map((cardKey) => {
                            const config = SportTypes.find(c => c.key === cardKey);
                            if (!config) return null;

                            const Icon = config.icon;
                            const cardData = (formData.sportCards as any)[cardKey];

                            return (
                                <div
                                    key={cardKey}
                                    className={`p-5 rounded-[24px] border border-opacity-40 space-y-4 animate-in zoom-in-95 slide-in-from-top-2 duration-300 ${config.bg} ${config.border}`}
                                >
                                    {/* 头部：标题与数值展示 */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${config.color} shadow-sm`}>
                                                <Icon size={16} strokeWidth={2.5} />
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
                        {formData.sportCards.activeCards.length === 0 && (
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
                </div>
            )}
        </Dialog>
    );
}
