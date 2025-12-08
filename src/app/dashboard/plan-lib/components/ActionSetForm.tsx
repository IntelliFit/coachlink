'use client';

import React from 'react';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { CoachActionRow } from '@/types';
import { ActionOptionTemplate, ActionValueTemplate } from './PlanDayCard';
import { CoachPlanAction } from '@/app/api/plan-lib/add-template/entity';

interface ActionSetFormProps {
    set: CoachPlanAction;
    setIndex: number;
    actionOptions: { label: string; value: string; action: CoachActionRow }[];
    dayIndex: number;
    saving: boolean;
    onActionSetChange: (
        dayIndex: number,
        setIndex: number,
        field: string,
        value: string | number
    ) => void;
    actions: CoachActionRow[]; // 新增props
}

const ActionSetForm: React.FC<ActionSetFormProps> = ({
    set,
    setIndex,
    actionOptions,
    dayIndex,
    saving,
    onActionSetChange,
    actions // 解构新增props
}) => {
    // 根据actionId找到对应的action
    const currentAction = actions.find(action => action.id === set.actionId);

    // 根据attrs动态判断需要显示的字段
    const shouldShowField = (field: string): boolean => {
        // 如果没有定义attrs，则显示所有字段
        if (!currentAction?.attrs || currentAction.attrs.length === 0) {
            return true;
        }
        
        // 如果定义了attrs，则只显示包含在attrs中的字段
        return currentAction.attrs.includes(field);
    };

    // 定义字段配置
    const fieldConfig = [
        { 
            key: '组数', 
            label: '组数', 
            type: 'number', 
            paramKey: 'sets',
            placeholder: ''
        },
        { 
            key: '次数', 
            label: '次数', 
            type: 'number', 
            paramKey: 'reps',
            placeholder: ''
        },
        { 
            key: '强度', 
            label: '强度', 
            type: 'text', 
            paramKey: 'intensity',
            placeholder: 'RPE8 / 20kg 等'
        },
        { 
            key: '休息时间', 
            label: '休息(秒)', 
            type: 'number', 
            paramKey: 'restSeconds',
            placeholder: ''
        },
        { 
            key: '持续时间', 
            label: '持续时间(秒)', 
            type: 'number', 
            paramKey: 'duration',
            placeholder: ''
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
                <label className="block text-900 text-xs mb-1">动作 *</label>
                <Dropdown
                    value={set.actionId}
                    options={actionOptions}
                    onChange={(e) => {
                        onActionSetChange(dayIndex, setIndex, 'actionId', e.value || '')
                    }}
                    optionLabel="label"
                    placeholder="选择动作"
                    filter
                    className="w-full"
                    disabled={saving}
                    itemTemplate={(option) => <ActionOptionTemplate action={option.action} />}
                    valueTemplate={(option) => <ActionValueTemplate action={option?.action || null} />}
                />
            </div>

            {/* 基于attrs动态渲染字段 */}
            {fieldConfig
                .filter(field => shouldShowField(field.key))
                .map(field => (
                    <div key={field.key}>
                        <label className="block text-900 text-xs mb-1">{field.label}</label>
                        <InputText
                            value={set.params?.[field.paramKey]?.toString() || ''}
                            type={field.type as any}
                            onChange={(e) => {
                                const value = field.type === 'number' 
                                    ? Number(e.target.value) || 0 
                                    : e.target.value;
                                onActionSetChange(dayIndex, setIndex, 'params', { 
                                    ...set.params, 
                                    [field.paramKey]: value 
                                });
                            }}
                            placeholder={field.placeholder}
                            className="w-full"
                            disabled={saving}
                        />
                    </div>
                ))
            }
        </div>
    );
};

export default ActionSetForm;