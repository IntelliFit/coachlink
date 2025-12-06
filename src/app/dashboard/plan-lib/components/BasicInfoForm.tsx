'use client';

import React, { useEffect, useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { MultiSelect } from 'primereact/multiselect';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';

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
    variant = 'template'
}) => {

    const [templateTypes, setTemplateTypes] = useState<{ label: string, value: string }[]>([]);
    const isStudent = variant === 'student';

    useEffect(() => {
        const allTags = [
            '新手训练',
            '力量训练',
            '耐力训练',
            '增肌训练',
            '减脂训练',
            '康复训练',
            '功能性训练',
            '爆发力训练',
        ];

        setTemplateTypes(allTags.map(tag => ({ label: tag, value: tag })));
    }, []);


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
                            {/* 模板标签 */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm text-900 font-medium">模板标签</label>
                                <MultiSelect
                                    value={tags}
                                    options={templateTypes}
                                    onChange={(e) => onTagsChange(e.value)}
                                    placeholder="选择模板标签"
                                    className="text-sm"
                                    disabled={saving}
                                    display="chip"
                                />
                            </div>

                            {/* 适合学员等级 */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm text-900 font-medium">适合学员等级</label>
                                <Dropdown
                                    value={suitableFor}
                                    options={experienceLevels}
                                    onChange={(e) => onSuitableForChange(e.value)}
                                    placeholder="选择适合的学员等级"
                                    className="p-inputtext-sm"
                                    disabled={saving}
                                />
                            </div>
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
                                模板标签可以多选，用于标记训练计划的特点和适用人群。
                            </p>
                            <p>
                                "适合学员等级"用于标识该训练计划最适合的学员水平，请根据训练计划的复杂程度进行选择。
                            </p>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
};

export default BasicInfoForm;
