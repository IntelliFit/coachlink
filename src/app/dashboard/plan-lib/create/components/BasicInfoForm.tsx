'use client';

import React from 'react';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';

interface BasicInfoFormProps {
    name: string;
    description: string;
    type: string;
    onNameChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
    onTypeChange: (value: string) => void;
    saving: boolean;
    onSave: () => void;
}

const templateTypes = [
    { label: '新手训练', value: 'beginner' },
    { label: '力量训练', value: 'strength' },
    { label: '自定义', value: 'custom' }
];

const BasicInfoForm: React.FC<BasicInfoFormProps> = ({
    name,
    description,
    type,
    onNameChange,
    onDescriptionChange,
    onTypeChange,
    saving,
    onSave
}) => {
    return (
        <div className="flex flex-col gap-4 mb-10">

            <h2 className="text-xl font-semibold">模板基础信息</h2>

            <div className="
                p-5 
                bg-surface-0 
                border border-surface-200 
                shadow-sm 
                rounded-lg
                flex flex-col md:flex-row 
                gap-10
            ">
                {/* 左侧表单区域 */}
                <div className="flex flex-col gap-5 w-full md:max-w-md">

                    {/* 模板名称 */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm text-900 font-medium">模板名称 *</label>
                        <InputText
                            value={name}
                            onChange={(e) => onNameChange(e.target.value)}
                            placeholder="输入模板名称"
                            className="p-inputtext-sm"
                            disabled={saving}
                        />
                    </div>

                    {/* 模板描述 */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm text-900 font-medium">模板描述</label>
                        <InputText
                            value={description}
                            onChange={(e) => onDescriptionChange(e.target.value)}
                            placeholder="输入描述内容（可选）"
                            className="p-inputtext-sm"
                            disabled={saving}
                        />
                    </div>

                    {/* 模板类型 */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm text-900 font-medium">模板类型</label>
                        <Dropdown
                            value={type}
                            options={templateTypes}
                            onChange={(e) => onTypeChange(e.value)}
                            placeholder="选择模板类型"
                            className="p-inputtext-sm"
                            disabled={saving}
                        />
                    </div>
                </div>

                {/* 右侧说明文本 */}
                <div className="flex-1 hidden md:flex flex-col gap-3 text-sm text-surface-600">
                    <div className="font-medium text-900">说明</div>
                    <p>
                        设置模板的基本信息，包括名称、描述以及类型。
                        这些信息将帮助你在动作库和训练库中快速识别模板。
                    </p>
                    <p>
                        模板类型不同，可能会影响推荐规则和搜索筛选。
                    </p>
                </div>
            </div>

        </div>
    );
};

export default BasicInfoForm;
