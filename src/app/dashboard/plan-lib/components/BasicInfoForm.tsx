'use client';

import React, { useEffect, useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { MultiSelect } from 'primereact/multiselect';
import { trainingItemService } from '@/app/service/trainingItemService';
import { Info, Calendar } from 'lucide-react';

interface BasicInfoFormProps {
    name: string;
    description: string;
    executionNotice?: string;
    tags: string[];
    suitableFor: 'beginner' | 'intermediate' | 'advanced';
    onNameChange: (name: string) => void;
    onDescriptionChange: (description: string) => void;
    onExecutionNoticeChange?: (executionNotice: string) => void;
    onTagsChange: (tags: string[]) => void;
    onSuitableForChange: (suitableFor: 'beginner' | 'intermediate' | 'advanced') => void;
    saving: boolean;
    onSave: () => void;
    extraButton?: React.ReactNode;
    variant?: 'template' | 'student';
    // 新增props
    weekDays?: number[];
    onWeekDaysChange?: (days: number[]) => void;
    /**
     * 可选的训练项目标签列表（来自教练的问卷配置）
     * 如果提供，则使用此列表作为模板标签的可选项
     * 如果不提供，则回退到 training_items 全局表
     */
    availableTrainingTags?: string[];
    /** 隐藏标题与说明文字，并采用更紧凑的布局 */
    hideHeader?: boolean;
}

const BasicInfoForm: React.FC<BasicInfoFormProps> = ({
    name,
    description,
    executionNotice = '',
    tags,
    suitableFor,
    onNameChange,
    onDescriptionChange,
    onExecutionNoticeChange,
    onTagsChange,
    onSuitableForChange,
    saving,
    onSave,
    extraButton,
    variant = 'template',
    weekDays = [],
    onWeekDaysChange,
    availableTrainingTags,
    hideHeader = false
}) => {
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
        <div className={`flex flex-col mb-8 ${hideHeader ? 'gap-0' : 'gap-4'}`}>
            {/* 头部区域（hideHeader 时隐藏） */}
            {!hideHeader && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
                    <div>
                        <h2 className="text-base font-bold tracking-tight text-surface-900">
                            {isStudent ? '计划配置' : '模板定义'}
                        </h2>
                        <p className="text-sm text-surface-500 mt-0.5">
                            {isStudent ? '配置计划名称与目标' : '设置模板名称、标签与建议频率'}
                        </p>
                    </div>
                    {extraButton && <div className="flex gap-2">{extraButton}</div>}
                </div>
            )}

            {/* 主容器：AERO 风格，hideHeader 时更紧凑 */}
            <div className={`
                relative overflow-hidden bg-surface border border-surface-100
                rounded-3xl shadow-[0_1px_0_rgba(15,23,42,0.02)]
                flex flex-col lg:flex-row
                ${hideHeader ? 'p-4 md:p-5 gap-4 lg:gap-6' : 'p-5 md:p-6 gap-6 lg:gap-8'}
            `}>
                {/* 左侧表单区域 */}
                <div className={`flex flex-col w-full flex-1 ${hideHeader ? 'gap-4' : 'gap-5'}`}>
                    <div className={`grid grid-cols-1 md:grid-cols-2 ${hideHeader ? 'gap-3' : 'gap-4'}`}>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-black text-surface-500 uppercase tracking-widest px-1">
                                {isStudent ? '计划名称' : '模板名称'} *
                            </label>
                            <InputText
                                value={name}
                                onChange={(e) => onNameChange(e.target.value)}
                                placeholder="e.g. 夏季增肌进阶计划"
                                className="w-full border-surface-200 bg-surface-50/50 focus:bg-surface focus:border-primary rounded-2xl py-2.5 text-sm transition-all"
                                disabled={saving}
                            />
                        </div>

                        {!isStudent && (
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-black text-surface-500 uppercase tracking-widest px-1">训练项目</label>
                                <MultiSelect
                                    value={tags}
                                    options={templateTypes}
                                    onChange={(e) => onTagsChange(e.value)}
                                    placeholder="选择核心动作库"
                                    className="aero-multiselect w-full"
                                    panelClassName="aero-multiselect-panel"
                                    display="chip"
                                    filter
                                />
                            </div>
                        )}
                    </div>

                    {/* 描述区域 */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-black text-surface-500 uppercase tracking-widest px-1">详情描述</label>
                        <InputText
                            value={description}
                            onChange={(e) => onDescriptionChange(e.target.value)}
                            placeholder="简述此计划的核心目标（可选）"
                            className="w-full border-surface-200 bg-surface-50/50 focus:bg-surface focus:border-primary rounded-2xl py-2.5 text-sm transition-all"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-black text-surface-500 uppercase tracking-widest px-1">
                            {isStudent ? '学员执行须知' : '执行须知'}
                        </label>
                        <InputTextarea
                            value={executionNotice}
                            onChange={(e) => onExecutionNoticeChange?.(e.target.value)}
                            placeholder="例如：训练前先热身 10 分钟；疼痛时停止并联系教练；按 RPE 真实记录。"
                            rows={4}
                            autoResize
                            className="w-full border-surface-200 bg-surface-50/50 focus:bg-surface focus:border-primary rounded-2xl py-2.5 text-sm leading-relaxed transition-all"
                            disabled={saving || !onExecutionNoticeChange}
                        />
                    </div>

                    {/* 频率选择 */}
                    {!isStudent && (
                        <div className={hideHeader ? 'space-y-3' : 'space-y-4'}>
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <Calendar size={12} className="text-surface-500" />
                                    <label className="text-[11px] font-black text-surface-500 uppercase tracking-widest">建议每周频率</label>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {[1, 2, 3, 4, 5, 6, 7].map(n => {
                                        const active = weekDays.includes(n);
                                        return (
                                            <button
                                                key={n}
                                                type="button"
                                                onClick={() => {
                                                    const newDays = active ? weekDays.filter(d => d !== n) : [...weekDays, n];
                                                    onWeekDaysChange?.(newDays);
                                                }}
                                                className={`
                                                    px-4 py-1.5 rounded-full text-[11px] font-black transition-all cursor-pointer active:scale-[0.98]
                                                    ${active ? 'bg-surface-900 text-surface-0 shadow-sm' : 'bg-surface-50 text-surface-500 hover:bg-surface-100'}
                                                `}
                                            >
                                                {n} 次 / 周
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 右侧说明文本：转换为“轻量生产力”引导卡片 */}
                {!isStudent && (
                    <div className="lg:w-56 flex flex-col gap-3">
                        <div className="p-4 bg-surface-50/80 rounded-2xl border border-surface-100 space-y-3">
                            <div className="flex items-center gap-2 text-surface-900 font-black text-[11px] tracking-tight">
                                <Info size={12} />
                                <span>设计指南</span>
                            </div>
                            <div className="space-y-3 text-[11px] text-surface-500 leading-relaxed font-medium">
                                <div className="flex gap-2">
                                    <div className="w-2 h-2 rounded-full bg-primary-500/70 shrink-0 mt-1.5" />
                                    <p>训练项目标签主要用于<span className="text-surface-900 font-bold">归类和搜索</span>，保持少而准即可。</p>
                                </div>
                                <div className="flex gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500/60 shrink-0 mt-1.5" />
                                    <p>如果你主要靠 AI 生成计划，这里不用再维护复杂问卷条件，保持<span className="text-surface-900 font-bold">简单直白</span>就好。</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BasicInfoForm;
