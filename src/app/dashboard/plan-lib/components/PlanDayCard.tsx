'use client';

import React, { act, useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { CoachActionRow, CoachSubscriptionRow } from '@/types';
import CopyTrainingDayDialog from './CopyTrainingDayDialog';
import ActionSetForm from './ActionSetForm';
import { FormPlanTrainingDay } from '@/app/api/plan-lib/create-template/entity';
import { TrainingItem, TrainingOptionQuestion } from '@/types/questionnaires';

// 定义动作选项的接口
interface ActionOption {
    label: string;
    value: string;
    action: CoachActionRow;
}

// 自定义选项模板组件
export const ActionOptionTemplate: React.FC<{ action: CoachActionRow }> = ({ action }) => {
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

                    {action.enableAutoWeightCompute && (
                        <div className="bg-primary-100 text-primary-700 text-xs font-medium px-2 py-1 border-round rounded-lg">
                            自动计算重量
                        </div>
                    )}
                </div>
                {action.detail && (
                    <div className="text-sm text-surface-500 mt-1">{action.detail}</div>
                )}
            </div>
        </div>
    );
};

// 自定义选中值模板组件
export const ActionValueTemplate: React.FC<{ action: CoachActionRow | null }> = ({ action }) => {
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

            {action.enableAutoWeightCompute && (
                <div className="bg-primary-100 text-primary-700 text-xs font-medium px-2 py-1 border-round rounded-lg">
                    自动计算重量
                </div>
            )}
        </div>
    );
};

interface PlanDayCardProps {
    day: FormPlanTrainingDay;
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
        field: string,
        value: string | number | object
    ) => void;
    saving: boolean;
    totalDays: number;
    // 修改属性定义
    onCopyFromDay: (targetDayIndex: number, sourceDayIndex: number) => void;
    existingTrainingDays: FormPlanTrainingDay[];
    studentData?: any | null; // 添加studentData属性
    questions?: TrainingItem[];
    subscription?: CoachSubscriptionRow | null;
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
    existingTrainingDays,
    studentData,
    questions,
    subscription
}) => {
    // 添加状态管理
    const [copyDialogVisible, setCopyDialogVisible] = useState(false);
    // 条件筛选相关状态
    const [filterDialogVisible, setFilterDialogVisible] = useState(false);
    const [selectedQuestions, setSelectedQuestions] = useState<TrainingOptionQuestion[]>([]);
    const [currentActionSetIndex, setCurrentActionSetIndex] = useState<number | null>(null);
    const [activeTabIndexes, setActiveTabIndexes] = useState([]);

    useEffect(() => {
        const indexes = [];
        for (let i = 0; i < day.actionSets.length; i++) {
            indexes.push(0);
        }
        setActiveTabIndexes(indexes);

        const questions: TrainingOptionQuestion[] = [];
        for (const actionSet of day.actionSets) {
            if (actionSet.type === 'no-filter') {
                questions.push(null);
            } else {
                questions.push(actionSet.question);
            }
        }

        setSelectedQuestions(questions);
    }, [day]);

    // 将CoachActionRow数组转换为Dropdown选项
    const actionOptions: ActionOption[] = actions.map(action => ({
        label: action.name,
        value: action.id,
        action: action
    }));

    const actionName = (setIndex: number) => {
        const actionSet = day.actionSets[setIndex];

        if (actionSet.type === 'one-filter') {
            return actionSet.question.question;
        } else {
            const actionId = day.actionSets[setIndex].actionId;
            if (actionId) {
                return actionOptions.find(option => option.action.id === actionId)?.label || '';
            }

            return '';
        }
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

    const optionQuestions = questions?.filter(
        q => q.type === 'option'
    ) as TrainingOptionQuestion[] || [];

    // 检查是否应该显示条件筛选按钮
    const shouldShowFilterButton = questions && optionQuestions.length > 0;

    // 处理条件筛选
    const handleFilterSelect = (question: TrainingOptionQuestion) => {
        const newSelectedQuestions = [...selectedQuestions];
        newSelectedQuestions[currentActionSetIndex] = question;
        setSelectedQuestions(newSelectedQuestions);

        const actionSet = day.actionSets[currentActionSetIndex];
        actionSet.type = 'one-filter';
        actionSet.question = question;
        // 初始化 actions
        actionSet.actions = question.options.map(option => ({
            type: 'no-filter',
            actionId: '',
            setName: '',
            params: {}
        }));
        onActionSetChange(dayIndex, currentActionSetIndex, 'all', actionSet);

        const newActiveIndexes = [...activeTabIndexes];
        newActiveIndexes[currentActionSetIndex] = 0;
        setActiveTabIndexes(newActiveIndexes);

        setFilterDialogVisible(false);
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
                                    className="p-4 bg-surface-100 rounded-sm shadow-sm border border-surface-200"
                                >
                                    {/* 动作卡片头部 */}
                                    <div className="flex justify-between items-start mb-3">
                                        <div className='flex gap-2 items-center'>
                                            <h5 className="font-medium text-900 text-md">
                                                A{setIndex + 1} {actionName(setIndex)}
                                            </h5>
                                            {shouldShowFilterButton && (
                                                <Button
                                                    icon="pi pi-filter"
                                                    text
                                                    size='small'
                                                    className="p-button-sm p-button-outlined"
                                                    onClick={() => {
                                                        setCurrentActionSetIndex(setIndex);
                                                        setFilterDialogVisible(true);
                                                    }}
                                                    tooltip="设置条件筛选"
                                                />
                                            )}

                                            {selectedQuestions[setIndex] && (
                                                selectedQuestions[setIndex].options.map((option, index) => (
                                                    <Button
                                                        key={index}
                                                        text={activeTabIndexes[setIndex] !== index}
                                                        outlined={activeTabIndexes[setIndex] === index}
                                                        size='small'
                                                        onClick={() => {
                                                            setActiveTabIndexes(prev => {
                                                                const newIndexes = [...prev];
                                                                newIndexes[setIndex] = index;
                                                                return newIndexes;
                                                            });
                                                        }}
                                                        label={option}
                                                    />
                                                ))
                                            )}
                                        </div>

                                        <Button
                                            icon="pi pi-trash"
                                            text
                                            size='small'
                                            className="p-button-rounded p-button-text p-button-danger p-button-sm"
                                            onClick={() => onRemoveActionSet(dayIndex, setIndex)}
                                            disabled={saving}
                                        />
                                    </div>

                                    <ActionSetForm
                                        set={set.type === 'one-filter' ? set.actions[activeTabIndexes[setIndex] || 0] : set}
                                        setIndex={setIndex}
                                        actionOptions={actionOptions}
                                        dayIndex={dayIndex}
                                        saving={saving}
                                        onActionSetChange={(dayIndex: number,
                                            innerSetIndex: number,
                                            field: string,
                                            value: string | number
                                        ) => {
                                            if (set.type === 'one-filter') {
                                                switch (field) {
                                                    case 'actionId':
                                                    case 'setName':
                                                        set.actions[activeTabIndexes[setIndex]][field] = value as string;
                                                        break;
                                                    case 'params':
                                                        set.actions[activeTabIndexes[setIndex]].params = {
                                                            ...set.actions[activeTabIndexes[setIndex]].params,
                                                            ...(value as any)
                                                        };
                                                        break;
                                                    case 'all':
                                                        set.actions[activeTabIndexes[setIndex]] = value as any;
                                                        break;
                                                    default:
                                                        throw new Error(`Unknown field: ${field}`);
                                                }
                                                onActionSetChange(dayIndex, setIndex, 'all', set);
                                            } else {
                                                onActionSetChange(dayIndex, innerSetIndex, field, value);

                                            }
                                        }}
                                        actions={actions}
                                        studentData={studentData}
                                        subscription={subscription}
                                    />



                                </div>

                            ))}
                        </div>
                    )}

                    {/* 备注 */}
                    <div className="mt-5 mb-5">
                        <label className="block text-900 font-medium text-sm mb-2">备注</label>
                        <InputTextarea
                            value={day.note || ''}
                            onChange={(e) => onNoteChange(dayIndex, e.target.value)}
                            placeholder="训练日备注（可选）"
                            className="w-full"
                            disabled={saving}
                        />
                    </div>

                    {/* 条件筛选对话框 */}
                    {shouldShowFilterButton && (
                        <ConfirmDialog
                            visible={filterDialogVisible}
                            onHide={() => setFilterDialogVisible(false)}
                            message={
                                <div className="flex flex-col gap-3 p-3">
                                    <div className='text-sm text-surface-400 mb-4'>
                                        <span>为当前动作选择一个分支条件用于匹配AI计划，

                                            <br />
                                            如果需要修改下面的选项，请前往

                                            <a href="/dashboard/questionnaire" className='text-primary underline'>学员问卷</a>
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {optionQuestions.map((question, index) => (
                                            <Button
                                                key={index}
                                                label={`${index + 1}. ${question.question}(共${question.options.length}项)`}
                                                onClick={() => handleFilterSelect(question)}
                                                className="p-button-outlined text-left justify-start"
                                            />
                                        ))}
                                    </div>
                                </div>
                            }
                            header="选择筛选条件"
                            footer={
                                <div className="flex justify-end gap-2">
                                    <Button
                                        label="取消当前条件"
                                        icon="pi pi-times"
                                        onClick={() => {
                                            const newSelectedQuestions = [...selectedQuestions];
                                            newSelectedQuestions[currentActionSetIndex] = null;
                                            setSelectedQuestions(newSelectedQuestions);

                                            setFilterDialogVisible(false);
                                        }}
                                        className="p-button-text"
                                    />
                                </div>
                            }
                        />
                    )}
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