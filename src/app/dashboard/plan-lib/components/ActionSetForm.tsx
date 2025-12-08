'use client';

import React from 'react';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { CoachActionRow } from '@/types';
import { ActionOptionTemplate, ActionValueTemplate } from './PlanDayCard';
import { CoachPlanAction } from '@/app/api/plan-lib/add-template/entity';
import { InputNumber } from 'primereact/inputnumber';

interface ActionSet extends CoachPlanAction {
    setName: string;
}

interface ActionSetFormProps {
    set: ActionSet;
    setIndex: number;
    actionOptions: { label: string; value: string; action: CoachActionRow }[];
    dayIndex: number;
    saving: boolean;
    onActionSetChange: (
        dayIndex: number,
        setIndex: number,
        field: string,
        value: string | number | object
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

    const getUnit = (attr: string) => {
        switch (attr) {
            case '组数':
                return '组';
            
            case '次数':
                return '次';
            
            case '强度':
                return 'RM';
            
            case '休息时间':
                return 's';
            
            case '持续时间':
                return 's';

            default:
                break;
        }
    }

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
            {currentAction && currentAction.attrs
                .map(attr => (
                    <div key={attr}>
                        <label className="block text-900 text-xs mb-1">{attr}</label>
                        <InputNumber
                            value={set.params?.[attr] || 0}
                            onValueChange={(e) => {
                                const currentParams = set.params || {};
                                const newParams = { 
                                    ...currentParams, 
                                    [attr]: e.value
                                };
                                onActionSetChange(dayIndex, setIndex, 'params', newParams);
                            }}
                            suffix={getUnit(attr)}
                            className="w-full"
                            minFractionDigits={attr === '强度' ? 1 : 0}
                            showButtons
                            disabled={saving}
                        />
                    </div>
                ))
            }
        </div>
    );
};

export default ActionSetForm;