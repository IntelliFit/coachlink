'use client';

import React from 'react';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { CoachActionRow } from '@/types';
import { ActionOptionTemplate, ActionValueTemplate } from './PlanDayCard';

interface ActionSet {
    actionId: string;
    setName: string;
    sets: number;
    reps: number;
    intensity: string;
    restSeconds: number;
    duration?: number; // 添加持续时间字段
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
        field: keyof ActionSet,
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

            {shouldShowField('组数') && (
                <div>
                    <label className="block text-900 text-xs mb-1">组数</label>
                    <InputText
                        value={set.sets.toString()}
                        type="number"
                        onChange={(e) =>
                            onActionSetChange(dayIndex, setIndex, 'sets', Number(e.target.value) || 0)
                        }
                        className="w-full"
                        disabled={saving}
                    />
                </div>
            )}

            {shouldShowField('次数') && (
                <div>
                    <label className="block text-900 text-xs mb-1">次数</label>
                    <InputText
                        value={set.reps.toString()}
                        type="number"
                        onChange={(e) =>
                            onActionSetChange(dayIndex, setIndex, 'reps', Number(e.target.value) || 0)
                        }
                        className="w-full"
                        disabled={saving}
                    />
                </div>
            )}

            {shouldShowField('强度') && (
                <div>
                    <label className="block text-900 text-xs mb-1">强度</label>
                    <InputText
                        value={set.intensity}
                        onChange={(e) =>
                            onActionSetChange(dayIndex, setIndex, 'intensity', e.target.value)
                        }
                        placeholder="RPE8 / 20kg 等"
                        className="w-full"
                        disabled={saving}
                    />
                </div>
            )}

            {shouldShowField('休息时间') && (
                <div>
                    <label className="block text-900 text-xs mb-1">休息(秒)</label>
                    <InputText
                        value={set.restSeconds.toString()}
                        type="number"
                        onChange={(e) =>
                            onActionSetChange(dayIndex, setIndex, 'restSeconds', Number(e.target.value) || 0)
                        }
                        className="w-full"
                        disabled={saving}
                    />
                </div>
            )}
            
            {shouldShowField('持续时间') && (
                <div>
                    <label className="block text-900 text-xs mb-1">持续时间(秒)</label>
                    <InputText
                        value={set.duration?.toString() || ''}
                        type="number"
                        onChange={(e) =>
                            onActionSetChange(dayIndex, setIndex, 'duration', Number(e.target.value) || 0)
                        }
                        className="w-full"
                        disabled={saving}
                    />
                </div>
            )}
        </div>
    );
};

export default ActionSetForm;