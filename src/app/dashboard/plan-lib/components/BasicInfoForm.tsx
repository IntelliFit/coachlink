'use client';

import React, { useEffect, useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { MultiSelect } from 'primereact/multiselect';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { trainingItemService } from '@/app/service/trainingItemService';
import { useToastContext } from '@/context/ToastContext';
import { TrainingOptionQuestion } from '@/types/questionnaires';

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
    onGlobalAnswerChange?: (question: string, answerIndex: number) => void;
}

const experienceLevels = [
    { label: '新手学员', value: '新手学员' },
    { label: '中级学员', value: '中级学员' },
    { label: '高级学员', value: '高级学员' }
];

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
    onGlobalAnswerChange
}) => {

    const { showToast } = useToastContext();
    const [templateTypes, setTemplateTypes] = useState<{ label: string, value: string }[]>([]);
    const [loadingTemplateTypes, setLoadingTemplateTypes] = useState(false);
    const isStudent = variant === 'student';

    useEffect(() => {
        const loadTrainingItems = async () => {
            if (variant === 'template') {
                setLoadingTemplateTypes(true);
                try {
                    const response = await trainingItemService.listTrainingItems();
                    const items = response.trainingItems.map(item => ({
                        label: item.name,
                        value: item.name
                    }));
                    
                    setTemplateTypes(items);
                } catch (error) {
                    console.error('获取训练项目失败:', error);
                    showToast({ 
                        severity: 'error', 
                        summary: '获取训练项目失败', 
                        detail: error instanceof Error ? error.message : '未知错误' 
                    });
                } finally {
                    setLoadingTemplateTypes(false);
                }
            }
        };

        loadTrainingItems();
    }, [variant, showToast]);

    return (
        <div className="flex flex-col gap-4 mb-10">

            <div className='flex justify-between items-center'>
                <h2 className="text-xl font-semibold">
                    {isStudent ? '计划基础信息' : '模板基础信息'}
                </h2>
                <div>
                    {extraButton}
                </div>
            </div>


            <div className="
                p-5 
                bg-surface-0 
                border border-surface-200 
                rounded-lg
                flex flex-col md:flex-row 
                gap-10
            ">
                {/* 左侧表单区域 */}
                <div className={`flex flex-col gap-5 w-full ${isStudent ? '' : 'md:max-w-md'}`}>

                    {/* 名称 */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm text-900 font-medium">{isStudent ? '计划名称 *' : '模板名称 *'}</label>
                        <InputText
                            value={name}
                            onChange={(e) => onNameChange(e.target.value)}
                            placeholder={isStudent ? "输入计划名称" : "输入模板名称"}
                            className="p-inputtext-sm"
                            disabled={saving}
                        />
                    </div>

                    {/* 描述 */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm text-900 font-medium">{isStudent ? '计划描述' : '模板描述'}</label>
                        <InputText
                            value={description}
                            onChange={(e) => onDescriptionChange(e.target.value)}
                            placeholder="输入描述内容（可选）"
                            className="p-inputtext-sm"
                            disabled={saving}
                        />
                    </div>

                    {!isStudent && (
                        <>
                            {/* 训练项目 */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm text-900 font-medium">训练项目</label>
                                <MultiSelect
                                    value={tags}
                                    options={templateTypes}
                                    onChange={(e) => onTagsChange(e.value)}
                                    placeholder="选择训练项目"
                                    className="text-sm"
                                    disabled={saving || loadingTemplateTypes}
                                    display="chip"
                                    filter
                                    showClear
                                    virtualScrollerOptions={{ itemSize: 38 }}
                                />
                            </div>


                        </>
                    )}

                    {!isStudent && (
                        <>
                            {/* 适用每周训练次数 */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm text-900 font-medium">适用每周训练次数</label>
                                <MultiSelect
                                    value={weekDays}
                                    options={[1, 2, 3, 4, 5, 6, 7].map(n => ({ label: `${n}次`, value: n }))}
                                    onChange={(e) => onWeekDaysChange?.(e.value)}
                                    placeholder="选择适用的训练频率"
                                    className="text-sm"
                                    disabled={saving}
                                    display="chip"
                                    showClear
                                />
                            </div>

                            {/* 动态显示全局选项问题 */}
                            {globalQuestions.map((question, idx) => (
                                <div key={idx} className="flex flex-col gap-2">
                                    <label className="text-sm text-900 font-medium">{question.question}</label>
                                    <div className="flex flex-wrap gap-2">
                                        {question.options.map((opt, i) => (
                                            <label
                                                key={i}
                                                className={`
                                                    flex items-center gap-2 px-4 py-2 
                                                    border rounded-lg cursor-pointer
                                                    transition-all duration-200
                                                    ${globalAnswers[question.question] === i
                                                        ? 'border-primary bg-primary/10 text-primary'
                                                        : 'border-surface-300 hover:border-primary/50 hover:bg-surface-50'
                                                    }
                                                    ${saving ? 'opacity-50 cursor-not-allowed' : ''}
                                                `}
                                            >
                                                <Checkbox
                                                    checked={globalAnswers[question.question] === i}
                                                    onChange={() => onGlobalAnswerChange?.(question.question, i)}
                                                    disabled={saving}
                                                    className="hidden"
                                                />
                                                <i className={`pi ${globalAnswers[question.question] === i ? 'pi-check-circle text-primary' : 'pi-circle text-surface-400'}`} />
                                                <span className="text-sm font-medium">{opt}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>

                {/* 右侧说明文本 */}
                {!isStudent && (
                    <div className="flex-1 hidden md:flex flex-col gap-3 text-sm text-surface-600">
                        <div>
                            <div className="font-medium text-900">说明</div>
                            <p>
                                设置模板的基本信息，包括名称、描述以及类型。
                                这些信息将帮助你在动作库和训练库中快速识别模板。
                            </p>
                            <p>
                                <strong>训练项目</strong>可以多选，用于标记训练计划的特点和适用人群。
                            </p>
                            <p>
                                <strong>适用每周训练次数</strong>用于匹配学员问卷中的训练频率，可多选（如2次、3次）。
                            </p>
                            <p>
                                <strong>全局选项问题</strong>会根据问卷设置自动显示，用于进一步匹配学员需求。
                            </p>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
};

export default BasicInfoForm;