'use client';

import React from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { CoachActionRow } from '@/types';

interface ActionSet {
    actionId: string;
    setName: string;
    sets: number;
    reps: number;
    intensity: string;
    restSeconds: number;
}

interface PlanDay {
    dayIndex: number;
    type: 'training' | 'rest';
    note: string;
    actionSets: ActionSet[];
}

interface PlanDayCardProps {
    day: PlanDay;
    dayIndex: number;
    actions: CoachActionRow[];
    onDayTypeChange: (index: number, type: 'training' | 'rest') => void;
    onRemoveDay: (index: number) => void;
    onNoteChange: (dayIndex: number, note: string) => void;
    onAddActionSet: (dayIndex: number) => void;
    onRemoveActionSet: (dayIndex: number, setIndex: number) => void;
    onActionSetChange: (
        dayIndex: number,
        setIndex: number,
        field: keyof ActionSet,
        value: string | number
    ) => void;
    saving: boolean;
    totalDays: number;
}

const PlanDayCard: React.FC<PlanDayCardProps> = ({
    day,
    dayIndex,
    actions,
    onDayTypeChange,
    onRemoveDay,
    onNoteChange,
    onAddActionSet,
    onRemoveActionSet,
    onActionSetChange,
    saving,
    totalDays
}) => {
    return (
        <Card className="shadow-sm bg-surface-50">
            <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-900">第 {day.dayIndex} 天</h3>

                    <div className="flex gap-2">
                        <Button
                            label="训练日"
                            className={`p-button-sm ${day.type === 'training' ? '' : 'p-button-outlined'}`}
                            onClick={() => onDayTypeChange(dayIndex, 'training')}
                            disabled={saving}
                        />

                        <Button
                            label="休息日"
                            className={`p-button-sm ${day.type === 'rest' ? '' : 'p-button-outlined'}`}
                            onClick={() => onDayTypeChange(dayIndex, 'rest')}
                            disabled={saving}
                        />
                    </div>
                </div>

                <Button
                    icon="pi pi-trash"
                    className="p-button-rounded p-button-text p-button-danger p-button-sm"
                    onClick={() => onRemoveDay(dayIndex)}
                    disabled={totalDays <= 1 || saving}
                    tooltip="删除训练日"
                />
            </div>

            {day.type === 'training' ? (
                <>
                    <div className="mb-4">
                        <label className="block text-900 font-medium mb-2">备注</label>
                        <InputText
                            value={day.note}
                            onChange={(e) => onNoteChange(dayIndex, e.target.value)}
                            placeholder="训练日备注（可选）"
                            className="w-full"
                            disabled={saving}
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-medium text-900">动作组</h4>
                            <Button
                                label="添加动作"
                                icon="pi pi-plus"
                                onClick={() => onAddActionSet(dayIndex)}
                                disabled={saving}
                                className="p-button-sm p-button-outlined"
                            />
                        </div>

                        {day.actionSets.length === 0 ? (
                            <div className="text-center py-6 bg-surface-100 border-round text-600">
                                该训练日暂无动作
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {day.actionSets.map((set, setIndex) => (
                                    <div
                                        key={setIndex}
                                        className="p-4 bg-surface-0 border-round shadow-sm"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <h5 className="font-medium text-900">
                                                动作 #{setIndex + 1}
                                            </h5>
                                            <Button
                                                icon="pi pi-trash"
                                                className="p-button-rounded p-button-text p-button-danger p-button-sm"
                                                onClick={() => onRemoveActionSet(dayIndex, setIndex)}
                                                disabled={saving}
                                                tooltip="删除动作"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="md:col-span-2">
                                                <label className="block text-900 text-sm mb-1">动作 *</label>
                                                <Dropdown
                                                    value={set.actionId}
                                                    options={actions.map(action => ({
                                                        label: action.name,
                                                        value: action.id
                                                    }))}
                                                    onChange={(e) =>
                                                        onActionSetChange(dayIndex, setIndex, 'actionId', e.value)
                                                    }
                                                    placeholder="选择动作"
                                                    filter
                                                    className="w-full"
                                                    disabled={saving}
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-900 text-sm mb-1">组数</label>
                                                <InputText
                                                    value={set.sets.toString()}
                                                    type="number"
                                                    min="1"
                                                    onChange={(e) =>
                                                        onActionSetChange(dayIndex, setIndex, 'sets', Number(e.target.value) || 0)
                                                    }
                                                    className="w-full"
                                                    disabled={saving}
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-900 text-sm mb-1">次数</label>
                                                <InputText
                                                    value={set.reps.toString()}
                                                    type="number"
                                                    min="1"
                                                    onChange={(e) =>
                                                        onActionSetChange(dayIndex, setIndex, 'reps', Number(e.target.value) || 0)
                                                    }
                                                    className="w-full"
                                                    disabled={saving}
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-900 text-sm mb-1">强度</label>
                                                <InputText
                                                    value={set.intensity}
                                                    onChange={(e) =>
                                                        onActionSetChange(dayIndex, setIndex, 'intensity', e.target.value)
                                                    }
                                                    placeholder="例如: RPE8, 20kg"
                                                    className="w-full"
                                                    disabled={saving}
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-900 text-sm mb-1">组间休息(秒)</label>
                                                <InputText
                                                    value={set.restSeconds.toString()}
                                                    type="number"
                                                    min="0"
                                                    onChange={(e) =>
                                                        onActionSetChange(dayIndex, setIndex, 'restSeconds', Number(e.target.value) || 0)
                                                    }
                                                    className="w-full"
                                                    disabled={saving}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="py-4 text-center text-600">
                    <i className="pi pi-calendar-times text-2xl mb-2"></i>
                    <p>休息日 - 无需安排训练内容</p>
                </div>
            )}
        </Card>

    );
};

export default PlanDayCard;