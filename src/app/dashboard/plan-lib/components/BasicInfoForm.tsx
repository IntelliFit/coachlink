'use client';

import React, { useEffect, useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { MultiSelect } from 'primereact/multiselect';
import { Checkbox } from 'primereact/checkbox';
import { trainingItemService } from '@/app/service/trainingItemService';
import { useToastContext } from '@/context/ToastContext';
import { TrainingOptionQuestion } from '@/types/questionnaires';
import { Sparkles, Info, Target, Calendar } from 'lucide-react';

interface BasicInfoFormProps {
    name: string;
    description: string;
    tags: string[];
    suitableFor: 'beginner' | 'intermediate' | 'advanced';
    onNameChange: (name: string) => void;
    onDescriptionChange: (description: string) => void;
    onTagsChange: (tags: string[]) => void;
    onSuitableForChange: (suitableFor: 'beginner' | 'intermediate' | 'advanced') => void;
    saving: boolean;
    onSave: () => void;
    extraButton?: React.ReactNode;
    variant?: 'template' | 'student';
    // 新增props
    weekDays?: number[];
    onWeekDaysChange?: (days: number[]) => void;
    globalQuestions?: TrainingOptionQuestion[];
    globalAnswers?: Record<string, number>;
    /**
     * Pass `null` to clear (unanswer) a question.
     */
    onGlobalAnswerChange?: (question: string, answerIndex: number | null) => void;
    /**
     * 可选的训练项目标签列表（来自教练的问卷配置）
     * 如果提供，则使用此列表作为模板标签的可选项
     * 如果不提供，则回退到 training_items 全局表
     */
    availableTrainingTags?: string[];
}

const BasicInfoForm: React.FC<BasicInfoFormProps> = ({
    name,
    description,
    tags,
    suitableFor,
    onNameChange,
    onDescriptionChange,
    onTagsChange,
    onSuitableForChange,
    saving,
    onSave,
    extraButton,
    variant = 'template',
    weekDays = [],
    onWeekDaysChange,
    globalQuestions = [],
    globalAnswers = {},
    onGlobalAnswerChange,
    availableTrainingTags
}) => {

    const { showToast } = useToastContext();
    const [fallbackTypes, setFallbackTypes] = useState<{ label: string, value: string }[]>([]);
    const [loadingFallback, setLoadingFallback] = useState(false);
    const isStudent = variant === 'student';

    // 计算最终使用的训练项目选项：优先使用问卷配置的，否则回退到 training_items
    const templateTypes: { label: string, value: string }[] = React.useMemo(() => {
        if (availableTrainingTags && availableTrainingTags.length > 0) {
            return availableTrainingTags.map(tag => ({ label: tag, value: tag }));
        }
        return fallbackTypes;
    }, [availableTrainingTags, fallbackTypes]);

    // 只有在没有提供 availableTrainingTags 时才加载 training_items 作为回退
    useEffect(() => {
        const loadTrainingItems = async () => {
            if (variant === 'template' && (!availableTrainingTags || availableTrainingTags.length === 0)) {
                setLoadingFallback(true);
                try {
                    const response = await trainingItemService.listTrainingItems();
                    const items = response.trainingItems.map(item => ({
                        label: item.name,
                        value: item.name
                    }));
                    
                    setFallbackTypes(items);
                } catch (error) {
                    console.error('获取训练项目失败:', error);
                    // 静默失败，问卷配置可能还没设置训练项目
                } finally {
                    setLoadingFallback(false);
                }
            }
        };

        loadTrainingItems();
    }, [variant, availableTrainingTags]);

    return (
        <div className="flex flex-col gap-6 mb-12">
            {/* 头部区域：紧凑字间距 + 呼吸感引导 */}
            <div className='flex justify-between items-end px-1'>
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-black text-surface-900 tracking-tighter">
                        {isStudent ? '计划配置' : '模板定义'}
                    </h2>
                </div>
                <div className="flex gap-2">
                    {extraButton}
                </div>
            </div>

            {/* 主容器：非线性圆角 + 极浅边框 */}
            <div className="
                relative overflow-hidden
                p-8 bg-surface border border-surface-200/70 
                rounded-[24px] shadow-[0_4px_20px_rgba(0,0,0,0.02)]
                flex flex-col lg:flex-row gap-12
            ">
                {/* 左侧表单区域：利用层级代替分割线 */}
                <div className="flex flex-col gap-8 w-full flex-1">
                    
                    {/* 第一行：双列布局以节省空间并保持紧凑 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-2">
                            <label className="text-[11px] text-surface-400 uppercase px-1">
                                {isStudent ? '计划名称' : '模板名称'} *
                            </label>
                            <InputText
                                value={name}
                                onChange={(e) => onNameChange(e.target.value)}
                                placeholder="e.g. 夏季增肌进阶计划"
                                className="w-full border-surface-200 bg-surface-50/50 focus:bg-surface focus:border-primary rounded-2xl py-3 transition-all"
                                disabled={saving}
                            />
                        </div>

                        {!isStudent && (
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-black text-surface-400 uppercase tracking-widest px-1">训练项目</label>
                                <MultiSelect
                                    value={tags}
                                    options={templateTypes}
                                    onChange={(e) => onTagsChange(e.value)}
                                    placeholder="选择核心动作库"
                                    className="aero-multiselect"
                                    display="chip"
                                    filter
                                />
                            </div>
                        )}
                    </div>

                    {/* 描述区域：使用半透明背景块 */}
                    <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-black text-surface-400 uppercase tracking-widest px-1">详情描述</label>
                        <InputText
                            value={description}
                            onChange={(e) => onDescriptionChange(e.target.value)}
                            placeholder="简述此计划的核心目标（可选）"
                            className="w-full border-surface-200 bg-surface-50/50 focus:bg-surface focus:border-primary rounded-2xl py-3 transition-all"
                        />
                    </div>

                    {/* 频率选择：非对称过渡选项 */}
                    {!isStudent && (
                        <div className="space-y-6">
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <Calendar size={14} className="text-surface-400" />
                                    <label className="text-[11px] font-black text-surface-400 uppercase tracking-widest">建议每周频率</label>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {[1, 2, 3, 4, 5, 6, 7].map(n => {
                                        const active = weekDays.includes(n);
                                        return (
                                            <div 
                                                key={n}
                                                onClick={() => {
                                                    const newDays = active ? weekDays.filter(d => d !== n) : [...weekDays, n];
                                                    onWeekDaysChange?.(newDays);
                                                }}
                                                className={`
                                                    px-5 py-2 rounded-full text-xs font-black transition-all duration-300 cursor-pointer active:scale-[0.95]
                                                    ${active ? 'bg-primary-500 text-surface shadow-md shadow-primary-500/20' : 'bg-surface-50 text-surface-400 hover:bg-surface-100'}
                                                `}
                                            >
                                                {n} 次 / 周
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 动态全局问题：数值中心化选择 */}
                            {globalQuestions.map((question, idx) => (
                                <div key={idx} className="flex flex-col gap-3">
                                    <label className="text-[11px] font-black text-surface-400 uppercase tracking-widest px-1">{question.question}</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {question.options.map((opt, i) => {
                                            const selected = globalAnswers[question.question] === i;
                                            return (
                                                <div
                                                    key={i}
                                                    onClick={() => onGlobalAnswerChange?.(question.question, selected ? null : i)}
                                                    className={`
                                                        p-3 rounded-[16px] border transition-all duration-300 cursor-pointer text-center
                                                        ${selected 
                                                            ? 'border-primary-200 bg-primary-50 text-primary-700 font-bold' 
                                                            : 'border-surface-100 bg-surface-50/30 text-surface-500 hover:border-surface-200'
                                                        }
                                                    `}
                                                >
                                                    <span className="text-[11px] tracking-tight">{opt}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="text-[11px] text-surface-400 px-1">
                                        可不选；再次点击已选项可取消。
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 右侧说明文本：转换为“轻量生产力”引导卡片 */}
                {!isStudent && (
                    <div className="lg:w-64 flex flex-col gap-4">
                        <div className="p-6 bg-surface-50/50 rounded-[20px] border border-surface-100/50 space-y-4">
                            <div className="flex items-center gap-2 text-surface-900 font-black text-xs tracking-tight">
                                <Info size={14} />
                                <span>设计指南</span>
                            </div>
                            <div className="space-y-4 text-[11px] text-surface-500 leading-relaxed font-medium">
                                <div className="flex gap-2">
                                    <Target size={12} className="shrink-0 text-primary-400" />
                                    <p>训练项目会直接关联动作库的<span className="text-surface-900 font-bold">自动筛选</span>逻辑。</p>
                                </div>
                                <div className="flex gap-2">
                                    <div className="w-3 h-3 rounded-full bg-green-100 shrink-0" />
                                    <p>每周次数用于匹配学员问卷，实现<span className="text-surface-900 font-bold">智能分发</span>。</p>
                                </div>
                            </div>
                        </div>
                        
                        {/* 装饰位：体现 Aero 风格的层级 */}
                        <div className="flex-1 rounded-[20px] bg-gradient-to-br from-primary-50 to-transparent opacity-40 border border-dashed border-primary-200" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default BasicInfoForm;