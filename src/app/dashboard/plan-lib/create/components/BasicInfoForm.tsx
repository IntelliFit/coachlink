'use client';

import React from 'react';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';

interface BasicInfoFormProps {
  name: string;
  description: string;
  type: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  saving: boolean;
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
  saving
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <label className="block text-900 font-medium mb-2">模板名称 *</label>
        <InputText
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="输入模板名称"
          className="w-full"
          disabled={saving}
        />
      </div>
      
      <div className="md:col-span-2">
        <label className="block text-900 font-medium mb-2">描述</label>
        <InputTextarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="输入模板描述"
          rows={3}
          className="w-full"
          disabled={saving}
        />
      </div>
      
      <div>
        <label className="block text-900 font-medium mb-2">类型</label>
        <Dropdown
          value={type}
          options={templateTypes}
          onChange={(e) => onTypeChange(e.value)}
          placeholder="选择类型"
          className="w-full"
          disabled={saving}
        />
      </div>
    </div>
  );
};

export default BasicInfoForm;