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
            <h2>
                <span className="text-xl font-semibold">设置模板信息</span>
            </h2>

            {/* 左右布局 */}
            <div className="flex flex-col md:flex-row gap-6 md:gap-10 justify-between">

                {/* 左侧：限制最大宽度，不再无限拉伸 */}
                <div className="flex flex-col gap-3 w-full md:max-w-xl">

                    <InputText
                        value={name}
                        onChange={(e) => onNameChange(e.target.value)}
                        placeholder="输入模板名称"
                        className="text-sm"
                        disabled={saving}
                    />

                    <InputText
                        value={description}
                        onChange={(e) => onDescriptionChange(e.target.value)}
                        placeholder="输入模板描述"
                        className="text-sm"
                        disabled={saving}
                    />

                    <Dropdown
                        value={type}
                        options={templateTypes}
                        onChange={(e) => onTypeChange(e.value)}
                        placeholder="选择类型"
                        className="p-inputtext-sm"
                        disabled={saving}
                    />
                </div>

                {/* 右侧：保存按钮 */}
                <div className="flex flex-col md:w-60 gap-3">
                    <Button
                        label="保存模板"
                        icon="pi pi-save"
                        className="p-button-sm w-full"
                        onClick={onSave}
                        loading={saving}
                    />
                </div>
            </div>

        </div>
    );
};

export default BasicInfoForm;
