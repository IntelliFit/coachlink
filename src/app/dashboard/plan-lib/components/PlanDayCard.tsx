'use client';

import React, { useState } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { CoachActionRow } from '@/types';
import CopyTrainingDayDialog from './CopyTrainingDayDialog';

// 定义动作选项的接口
interface ActionOption {
    label: string;
    value: string;
    action: CoachActionRow;
}

// 自定义选项模板组件
const ActionOptionTemplate: React.FC<{ action: CoachActionRow }> = ({ action }) => {
    return (
        <div className="flex align-items-center">
            <div className="ml-2 flex-grow">
                <div className="flex align-items-center gap-2">
                    <div className="font-bold">{action.name}</div>
                    {(action.positions || []).map((position, idx) => (
                        <div className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 border-round rounded-lg"
                            key={idx}
                        >
                            {position}
                        </div>
                    ))}
                </div>
                {action.detail && (
                    <div className="text-sm text-surface-500 mt-1">{action.detail}</div>
                )}
            </div>
        </div>
    );
};

// 自定义选中值模板组件
const ActionValueTemplate: React.FC<{ action: CoachActionRow | null }> = ({ action }) => {
    if (!action) {
        return <span>选择动作</span>;
    }

    return (
        <div className="flex align-items-center gap-2">
            <div className="font-bold">{action.name}</div>
            {(action.positions || []).map((position, idx) => (
                <div
                    key={idx}
                    className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 border-round rounded-lg"
                >
                    {position}
                </div>
            ))}
        </div>
    );
};


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
    // 修改属性定义
    onCopyFromDay: (targetDayIndex: number, sourceDayIndex: number) => void;
    existingTrainingDays: { 
        dayIndex: number; 
        actionSetsCount: number; 
        type: 'training' | 'rest'; 
        note: string;
        actionSets?: ActionSet[];
    }[];
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
    totalDays,
    onCopyFromDay,
    existingTrainingDays
}) => {
    // 添加状态管理
    const [copyDialogVisible, setCopyDialogVisible] = useState(false);
    
    // 将CoachActionRow数组转换为Dropdown选项
    const actionOptions: ActionOption[] = actions.map(action => ({
        label: action.name,
        value: action.id,
        action: action
    }));

    const actionName = (setIndex: number) => {
        const actionId = day.actionSets[setIndex].actionId;
        if (actionId) {
            return actionOptions.find(option => option.action.id === actionId)?.label || '';
        }

        return '';
    }

    // 处理复制操作
    const handleCopyFromDay = (targetDayIndex: number, sourceDayIndex: number) => {
        // 检查是否需要确认覆盖
        const hasContent = day.note.trim() !== '' || day.actionSets.length > 0;
        
        if (hasContent) {
            // 显示确认对话框
            confirmDialog({
                message: '当前训练日已有内容，复制将覆盖现有内容，是否继续？',
                header: '确认覆盖',
                icon: 'pi pi-exclamation-triangle',
                acceptLabel: '确认',
                rejectLabel: '取消',
                accept: () => {
                    onCopyFromDay(targetDayIndex, sourceDayIndex)
                }
            });
        } else {
            onCopyFromDay(targetDayIndex, sourceDayIndex)
        }
    };

    return (
        <div className="p-5">
            {/* Header */}
            <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold text-900 mr-2">第 {dayIndex + 1} 天 - W{Math.ceil((dayIndex + 1) / 7)}D{(dayIndex) % 7 + 1}</h3>

                    <div className="flex gap-2">
                        <Button
                            label="训练日"
                            className={`p-button-sm ${day.type === 'training' ? '' : 'p-button-outlined'
                                }`}
                            onClick={() => onDayTypeChange(dayIndex, 'training')}
                            disabled={saving}
                        />

                        <Button
                            label="休息日"
                            className={`p-button-sm ${day.type === 'rest' ? '' : 'p-button-outlined'
                                }`}
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
                />
            </div>

            {/* 动作组标题 */}
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium text-900 text-md"></h4>
                <div className="flex gap-2">
                    {existingTrainingDays && existingTrainingDays.length > 0 && onCopyFromDay && (
                        // 替换原来的 Dropdown 为 Button
                        <Button
                            label="从其他训练日复制"
                            icon="pi pi-copy"
                            onClick={() => setCopyDialogVisible(true)}
                            disabled={saving}
                            className="p-button-sm"
                        />
                    )}
                    {day.type === 'training' && (
                        <Button
                            label="添加动作"
                            icon="pi pi-plus"
                            onClick={() => onAddActionSet(day.dayIndex)}
                            disabled={saving}
                            className="p-button-sm p-button-outlined"
                        />
                    )}
                </div>
            </div>

            {day.type === 'training' ? (
                <>
                    {/* 无动作 */}
                    {day.actionSets.length === 0 ? (
                        <div>
                            <br />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {day.actionSets.map((set, setIndex) => (
                                <div
                                    key={setIndex}
                                    className="p-4 bg-surface-50 border-round-lg shadow-sm border-1 border-surface-200"
                                >
                                    {/* 动作卡片头部 */}
                                    <div className="flex justify-between items-start mb-3">
                                        <h5 className="font-medium text-900 text-md">
                                            A{setIndex + 1} {actionName(setIndex)}
                                        </h5>
                                        <Button
                                            icon="pi pi-trash"
                                            className="p-button-rounded p-button-text p-button-danger p-button-sm"
                                            onClick={() => onRemoveActionSet(dayIndex, setIndex)}
                                            disabled={saving}
                                        />
                                    </div>

                                    {/* 表单 */}
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
                                    </div>
                                </div>

                            ))}
                        </div>
                    )}

                    {/* 备注 */}
                    <div className="mt-5 mb-5">
                        <label className="block text-900 font-medium text-sm mb-2">备注</label>
                        <InputTextarea
                            value={day.note}
                            onChange={(e) => onNoteChange(dayIndex, e.target.value)}
                            placeholder="训练日备注（可选）"
                            className="w-full"
                            disabled={saving}
                        />
                    </div>
                </>
            ) : (
                <>

                    <div className="py-8 px-4 text-center text-600 flex items-center justify-center min-h-10rem">
                        <div className="flex flex-col items-center max-w-md w-full">

                            {/* 图标 + 文案 */}
                            <i className="pi pi-moon text-3xl mb-4"></i>
                            <p className="text-sm mb-6">休息日 - 无需安排训练内容</p>
                        </div>
                    </div>
                    {/* 备注 */}
                    <div className="mt-5 mb-5">
                        <label className="block text-900 font-medium text-sm mb-2">备注</label>
                        <InputTextarea
                            value={day.note}
                            onChange={(e) => onNoteChange(dayIndex, e.target.value)}
                            placeholder="训练日备注（可选）"
                            className="w-full"
                            disabled={saving}
                        />
                    </div>
                </>
            )}
            
            {/* 添加复制对话框 */}
            {existingTrainingDays && existingTrainingDays.length > 0 && (
                <CopyTrainingDayDialog
                    visible={copyDialogVisible}
                    onHide={() => setCopyDialogVisible(false)}
                    trainingDays={existingTrainingDays}
                    onSelectDay={(sourceDayIndex) => {
                        handleCopyFromDay(dayIndex + 1, sourceDayIndex);
                        setCopyDialogVisible(false);
                    }}
                    saving={saving}
                    actions={actions}
                    targetDayIndex={dayIndex}
                />
            )}
            
            <ConfirmDialog />
        </div>
    );
};

export default PlanDayCard;