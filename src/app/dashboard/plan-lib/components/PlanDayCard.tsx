'use client';

import React, { act, useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { CoachActionRow, CoachSubscriptionRow, ItemType } from '@/types';
import CopyTrainingDayDialog from './CopyTrainingDayDialog';
import ActionSetForm from './ActionSetForm';
import ExecutionDetails from './ExecutionDetails';
import { FormPlanTrainingDay, CoachPlanAction } from '@/app/api/plan-lib/create-template/entity';
import { TrainingItem, TrainingOptionQuestion } from '@/types/questionnaires';
import { PolymorphicItemMenu } from './PolymorphicItemMenu';
import { DietItemForm } from './DietItemForm';
import { CardioItemForm } from './CardioItemForm';
import { HabitItemForm } from './HabitItemForm';

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
                    
                    {action.type && action.type !== 'STRENGTH' && (
                        <div className="bg-purple-100 text-purple-700 text-xs font-medium px-2 py-1 border-round rounded-lg">
                            {action.type}
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
    onAddActionSet: (dayIndex: number, type?: ItemType) => void; // 支持 type 参数
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
    execution?: any; // 添加执行数据属性
    planReference1RMs?: Record<string, number>;
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
    subscription,
    execution,
    planReference1RMs
}) => {
    // 添加状态管理
    const [copyDialogVisible, setCopyDialogVisible] = useState(false);
    // 条件筛选相关状态
    const [filterDialogVisible, setFilterDialogVisible] = useState(false);
    const [selectedQuestions, setSelectedQuestions] = useState<TrainingOptionQuestion[]>([]);
    const [currentActionSetIndex, setCurrentActionSetIndex] = useState<number | null>(null);
    const [activeTabIndexes, setActiveTabIndexes] = useState<number[]>([]);

    useEffect(() => {
        const indexes = [];
        for (let i = 0; i < day.actionSets.length; i++) {
            indexes.push(0);
        }
        setActiveTabIndexes(indexes);

        const questions: TrainingOptionQuestion[] = [];
        for (const actionSet of day.actionSets) {
            if (actionSet.type === 'no-filter') {
                questions.push(null as any);
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

    // 获取过滤后的动作选项
    const getFilteredOptions = (itemType: ItemType | undefined) => {
        return actions.filter(action => {
            // 如果是力量训练（或未定义），显示 STRENGTH 类型或无类型的动作
            if (!itemType || itemType === 'STRENGTH') {
                return !action.type || action.type === 'STRENGTH';
            }
            // 其他类型精确匹配
            return action.type === itemType;
        }).map(action => ({
            label: action.name,
            value: action.id,
            action: action
        }));
    };

    const actionName = (setIndex: number) => {
        const actionSet = day.actionSets[setIndex];

        // 优先显示 group_title (如果存在)
        if (actionSet.group_title) {
            // 这里可以处理分组显示的逻辑，目前暂时只返回标准名称
        }

        if (actionSet.type === 'one-filter') {
            return actionSet.question.question;
        } else {
            const actionId = (actionSet as any).actionId;
            const itemType = (actionSet as any).itemType;
            
            // 如果是非动作类型，显示自定义名称
            if (itemType && itemType !== 'STRENGTH') {
               const customName = (actionSet.params?.custom_data?.habit_name) || 
                                (itemType === 'DIET' ? '饮食建议' : 
                                 itemType === 'CARDIO' ? '有氧运动' : '习惯');
               return customName;
            }

            if (actionId) {
                return actionOptions.find(option => option.action.id === actionId)?.label || '';
            }

            return '';
        }
    }
    
    // 获取当前项的 ItemType
    const getItemType = (set: CoachPlanAction | any): ItemType => {
        return set.itemType || 'STRENGTH';
    };
    
    // 获取图标
    const getItemIcon = (type: ItemType) => {
        switch (type) {
            case 'DIET': return 'pi pi-apple';
            case 'CARDIO': return 'pi pi-heart';
            case 'HABIT': return 'pi pi-check-circle';
            default: return 'pi pi-bolt'; // STRENGTH
        }
    };
    
    // 获取颜色
    const getItemColorClass = (type: ItemType) => {
        switch (type) {
            case 'DIET': return 'text-orange-500 bg-orange-50';
            case 'CARDIO': return 'text-red-500 bg-red-50';
            case 'HABIT': return 'text-green-500 bg-green-50';
            default: return 'text-primary bg-primary-50';
        }
    };

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
        q => q.type === 'option' && q.scope !== 'global'  // 只显示非全局的选项问题
    ) as TrainingOptionQuestion[] || [];

    // 检查是否应该显示条件筛选按钮
    const shouldShowFilterButton = questions && optionQuestions.length > 0;

    // 处理条件筛选
    const handleFilterSelect = (question: TrainingOptionQuestion) => {
        if (currentActionSetIndex === null) return;
        
        const newSelectedQuestions = [...selectedQuestions];
        newSelectedQuestions[currentActionSetIndex] = question;
        setSelectedQuestions(newSelectedQuestions);

        const actionSet = day.actionSets[currentActionSetIndex];
        actionSet.type = 'one-filter';
        (actionSet as any).question = question;
        // 初始化 actions
        (actionSet as any).actions = question.options.map((option: any) => ({
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

    // 处理 Group Title 变更 (当前项及其后的所有同组项)
    const handleGroupTitleChange = (setIndex: number, newTitle: string) => {
         onActionSetChange(dayIndex, setIndex, 'group_title', newTitle);
         // 实际上应该由父组件处理批量更新，或者这里只更新当前项，依赖后端/上层逻辑聚合
         // 简化起见，这里我们认为 group_title 是 Item 属性，UI 渲染时会自动聚合
    };

    return (
        <div className="p-5">
            {/* Header */}
            <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold text-900 mr-2">第 {dayIndex + 1} 天 - W{Math.ceil((dayIndex + 1) / 7)}D{(dayIndex) % 7 + 1}</h3>

                    <div className="flex gap-2">
                        {totalDays > 1 && (
                            <Button
                                icon="pi pi-trash"
                                className="p-button-rounded p-button-danger p-button-text"
                                onClick={() => {
                                    confirmDialog({
                                        message: '确定要删除这个训练日吗？后面的训练日将自动前移。',
                                        header: '删除训练日',
                                        icon: 'pi pi-exclamation-triangle',
                                        accept: () => onRemoveDay(dayIndex),
                                        reject: () => { }
                                    });
                                }}
                                tooltip="删除此训练日"
                                disabled={saving}
                            />
                        )}
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
                        <PolymorphicItemMenu 
                            onAdd={(type) => onAddActionSet(day.dayIndex, type)}
                            disabled={saving}
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
                            {day.actionSets.map((set, setIndex) => {
                                const itemType = getItemType(set);
                                const isStrength = itemType === 'STRENGTH';
                                const prevSet = setIndex > 0 ? day.actionSets[setIndex - 1] : null;
                                
                                // 检查是否需要显示 Group Title 输入框
                                // 逻辑：如果是第一项，或者 group_title 与上一项不同
                                const showGroupTitle = setIndex === 0 || set.group_title !== (prevSet as any)?.group_title;

                                // 获取当前类型的过滤选项
                                const filteredOptions = getFilteredOptions(itemType);

                                return (
                                <div key={setIndex}>
                                    <div
                                        className={`p-4 rounded-sm shadow-sm border border-surface-200 ${isStrength ? 'bg-surface-0' : 'bg-surface-50'}`}
                                    >
                                        {/* 动作卡片头部 */}
                                        <div className="flex justify-between items-start mb-3">
                                            <div className='flex gap-2 items-center'>
                                                <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${getItemColorClass(itemType)}`}>
                                                    <i className={`${getItemIcon(itemType)} text-xs`}></i>
                                                </span>
                                                <h5 className="font-medium text-900 text-md">
                                                    #{setIndex + 1} {actionName(setIndex)}
                                                </h5>
                                                
                                                {/* 只有力量训练支持条件筛选 */}
                                                {isStrength && shouldShowFilterButton && (
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

                                                {isStrength && selectedQuestions[setIndex] && (
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
                                                onClick={() => onRemoveActionSet(day.dayIndex, setIndex)}
                                                disabled={saving}
                                            />
                                        </div>

                                        {/* 多态表单渲染 */}
                                        {itemType === 'STRENGTH' && (
                                            <ActionSetForm
                                                set={set.type === 'one-filter' ? (set as any).actions[activeTabIndexes[setIndex] || 0] : set}
                                                setIndex={setIndex}
                                                actionOptions={filteredOptions}
                                                dayIndex={dayIndex}
                                                saving={saving}
                                                onActionSetChange={(dayIndex: number,
                                                    innerSetIndex: number,
                                                    field: string,
                                                    value: string | number
                                                ) => {
                                                    if (set.type === 'one-filter') {
                                                        const activeIndex = activeTabIndexes[setIndex] || 0;
                                                        const actions = (set as any).actions;
                                                        
                                                        switch (field) {
                                                            case 'actionId':
                                                            case 'setName':
                                                                actions[activeIndex][field] = value as any;
                                                                break;
                                                            case 'params':
                                                                actions[activeIndex].params = {
                                                                    ...actions[activeIndex].params,
                                                                    ...(value as any)
                                                                };
                                                                break;
                                                            case 'all':
                                                                actions[activeIndex] = value as any;
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
                                                planReference1RM={planReference1RMs?.[set.type === 'one-filter' ? ((set as any).actions[activeTabIndexes[setIndex] || 0]?.actionId as string) : (set.actionId as string)]}
                                                isGlobalOneRMConfigEnabled={planReference1RMs !== undefined}
                                            />
                                        )}
                                        
                                        {itemType === 'DIET' && (
                                            <DietItemForm 
                                                item={set as any} 
                                                setIndex={setIndex}
                                                dayIndex={dayIndex}
                                                saving={saving}
                                                onUpdate={onActionSetChange}
                                                actionOptions={filteredOptions}
                                            />
                                        )}

                                        {itemType === 'CARDIO' && (
                                            <CardioItemForm 
                                                item={set as any}
                                                setIndex={setIndex}
                                                dayIndex={dayIndex}
                                                saving={saving}
                                                onUpdate={onActionSetChange}
                                                actionOptions={filteredOptions}
                                            />
                                        )}
                                        
                                        {itemType === 'HABIT' && (
                                            <HabitItemForm 
                                                item={set as any}
                                                setIndex={setIndex}
                                                dayIndex={dayIndex}
                                                saving={saving}
                                                onUpdate={onActionSetChange}
                                                actionOptions={filteredOptions}
                                            />
                                        )}

                                    </div>
                                </div>
                                );
                            })}
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

                    {/* 学员执行情况 */}
                    <ExecutionDetails execution={execution} />

                    {/* 条件筛选对话框 */}
                    {shouldShowFilterButton && (
                        <ConfirmDialog
                            visible={filterDialogVisible}
                            onHide={() => setFilterDialogVisible(false)}
                            message={
                                <div className="flex flex-col gap-3 p-3">
                                    <div className='text-sm text-surface-400 mb-4'>
                                        <span>为当前动作选择一个分支条件用于匹配智能计划，

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
                                            if (currentActionSetIndex === null) return;
                                            const newSelectedQuestions = [...selectedQuestions];
                                            newSelectedQuestions[currentActionSetIndex] = null as any;
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