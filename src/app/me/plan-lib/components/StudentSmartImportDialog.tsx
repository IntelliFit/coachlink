'use client';

import React, { useState, useCallback } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputText } from 'primereact/inputtext';
import { Steps } from 'primereact/steps';
import { Tag } from 'primereact/tag';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { ParsedStudentActionInfo } from '@/app/api/student/plan-lib/parse-actions/entity';

interface StudentSmartImportDialogProps {
    visible: boolean;
    onHide: () => void;
    existingActions: any[];
    onImportComplete: (trainingDays: any[]) => void;
}

interface Step {
    label: string;
}

const steps: Step[] = [
    { label: '输入文本' },
    { label: '确认动作' },
    { label: '预览计划' },
];

// 可编辑的动作信息
interface EditableAction extends ParsedStudentActionInfo {
    useExisting: boolean;
    selectedExistingId: string | null;
    shouldCreate: boolean;
}

// 解析后的训练日结构
interface ParsedDay {
    weekIndex: number;
    dayOfWeek: number;
    type: 'training' | 'rest';
    dayNote?: string;
    actions: {
        actionId: string;
        sets: number;
        reps: number;
        restSeconds?: number;
        intensityConfig?: any;
        note?: string;
    }[];
}

export default function StudentSmartImportDialog({
    visible,
    onHide,
    existingActions,
    onImportComplete,
}: StudentSmartImportDialogProps) {
    const [activeStep, setActiveStep] = useState(0);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Step 2: 可编辑的动作列表
    const [editableActions, setEditableActions] = useState<EditableAction[]>([]);
    
    // Step 3: 解析出的计划
    const [parsedWeeks, setParsedWeeks] = useState(0);
    const [parsedDays, setParsedDays] = useState<ParsedDay[]>([]);
    
    // 合并后的动作列表（包含新创建的）
    const [allActions, setAllActions] = useState<any[]>([]);

    // 重置状态
    const resetState = useCallback(() => {
        setActiveStep(0);
        setInputText('');
        setIsLoading(false);
        setError(null);
        setEditableActions([]);
        setParsedWeeks(0);
        setParsedDays([]);
        setAllActions([]);
    }, []);

    const handleHide = () => {
        resetState();
        onHide();
    };

    // Step 1: 解析动作
    const handleParseActions = async () => {
        if (!inputText.trim()) {
            setError('请输入训练计划文本');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // 使用学员版 API
            const response = await fetch('/api/student/plan-lib/parse-actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: inputText }),
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || '解析失败');
            }

            // 转换为可编辑格式
            const editable: EditableAction[] = result.data.actions.map((a: ParsedStudentActionInfo) => ({
                ...a,
                useExisting: !a.isNew,
                selectedExistingId: a.matchedExistingId || null,
                shouldCreate: a.isNew,
            }));
            
            setEditableActions(editable);
            setActiveStep(1);
        } catch (err: any) {
            setError(err.message || '解析动作失败');
        } finally {
            setIsLoading(false);
        }
    };

    // 更新单个动作的属性
    const updateAction = (index: number, updates: Partial<EditableAction>) => {
        setEditableActions(prev => {
            const newActions = [...prev];
            newActions[index] = { ...newActions[index], ...updates };
            return newActions;
        });
    };

    // 切换使用现有动作/创建新动作
    const toggleActionMode = (index: number) => {
        const action = editableActions[index];
        if (action.useExisting) {
            updateAction(index, {
                useExisting: false,
                selectedExistingId: null,
                shouldCreate: true,
            });
        } else {
            updateAction(index, {
                useExisting: true,
                shouldCreate: false,
            });
        }
    };

    // 选择现有动作
    const selectExistingAction = (index: number, actionId: string) => {
        const selectedAction = existingActions.find(a => a.id === actionId);
        if (selectedAction) {
            updateAction(index, {
                selectedExistingId: actionId,
                matchedExistingId: actionId,
                needsAutoCompute: selectedAction.enable_auto_weight_compute || false,
                includesBodyWeight: selectedAction.includes_body_weight || false,
            });
        }
    };

    // Step 2: 确认并创建新动作
    const handleConfirmActions = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // 筛选出需要创建的新动作
            const actionsToCreate = editableActions
                .filter(a => !a.useExisting && a.shouldCreate)
                .map(a => ({
                    name: a.name,
                    needsAutoCompute: a.needsAutoCompute,
                    includesBodyWeight: a.includesBodyWeight,
                }));

            let createdActions: any[] = [];

            if (actionsToCreate.length > 0) {
                // 使用学员版批量创建 API
                const createResponse = await fetch('/api/student/action-lib/batch-create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ actions: actionsToCreate }),
                });

                const createResult = await createResponse.json();
                if (!createResult.success) {
                    throw new Error(createResult.message || '创建动作失败');
                }
                createdActions = createResult.data.createdActions;
            }

            // 合并现有动作和新创建的动作
            const mergedActions = [...existingActions, ...createdActions];
            setAllActions(mergedActions);

            // 调用学员版解析模板 API
            const templateResponse = await fetch('/api/student/plan-lib/parse-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: inputText,
                    actions: mergedActions.map(a => ({
                        id: a.id,
                        name: a.name,
                    })),
                }),
            });

            const templateResult = await templateResponse.json();
            if (!templateResult.success) {
                throw new Error(templateResult.message || '解析计划失败');
            }

            setParsedWeeks(templateResult.data.weeks);
            setParsedDays(templateResult.data.trainingDays);
            setActiveStep(2);
        } catch (err: any) {
            setError(err.message || '处理失败');
        } finally {
            setIsLoading(false);
        }
    };

    // Step 3: 导入计划
    const handleImportPlan = () => {
        // 将解析的数据转换为学员计划库格式
        const trainingDays = convertToStudentPlanDays(parsedDays, parsedWeeks, allActions);
        onImportComplete(trainingDays);
        handleHide();
    };

    // 现有动作下拉选项
    const existingActionOptions = existingActions.map(a => ({
        label: a.name,
        value: a.id,
    }));

    // 获取动作名称
    const getActionName = (actionId: string): string => {
        const action = allActions.find(a => a.id === actionId);
        return action?.name || '未知动作';
    };

    // 渲染步骤内容
    const renderStepContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center py-12">
                    <ProgressSpinner style={{ width: '50px', height: '50px' }} />
                    <p className="mt-4 text-gray-600">正在处理中...</p>
                </div>
            );
        }

        switch (activeStep) {
            case 0:
                return (
                    <div className="flex flex-col gap-4">
                        <p className="text-sm text-gray-600">
                            请粘贴您的训练计划文本，系统将使用 AI 自动解析动作和训练结构。
                        </p>
                        <InputTextarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            rows={12}
                            placeholder={`示例格式：
W1 D1 
70%rm 4*4 负重引体 rpe9 组间60s 

D2
反握引体 70% 4*4 rpe8

**休息1天**
- 拉伸、松解`}
                            className="w-full font-mono text-sm"
                            autoResize
                        />
                        <div className="flex justify-end gap-2">
                            <Button
                                label="取消"
                                severity="secondary"
                                outlined
                                onClick={handleHide}
                            />
                            <Button
                                label="解析动作"
                                icon="pi pi-arrow-right"
                                iconPos="right"
                                onClick={handleParseActions}
                                disabled={!inputText.trim()}
                            />
                        </div>
                    </div>
                );

            case 1:
                return (
                    <div className="flex flex-col gap-4">
                        <Message 
                            severity="info" 
                            text="点击动作可编辑属性，点击「使用已有」可切换为选择现有动作" 
                            className="w-full"
                        />
                        <div className="max-h-96 overflow-y-auto border rounded-lg divide-y">
                            {editableActions.map((action, index) => (
                                <div
                                    key={index}
                                    className="p-3 hover:bg-gray-50"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            {action.useExisting ? (
                                                <i className="pi pi-link text-green-500 flex-shrink-0" />
                                            ) : (
                                                <Checkbox
                                                    checked={action.shouldCreate}
                                                    onChange={(e) => updateAction(index, { shouldCreate: e.checked || false })}
                                                />
                                            )}
                                            
                                            {action.useExisting ? (
                                                <Dropdown
                                                    value={action.selectedExistingId}
                                                    options={existingActionOptions}
                                                    onChange={(e) => selectExistingAction(index, e.value)}
                                                    placeholder="选择已有动作"
                                                    className="w-full max-w-xs"
                                                    filter
                                                    filterPlaceholder="搜索动作..."
                                                />
                                            ) : (
                                                <InputText
                                                    value={action.name}
                                                    onChange={(e) => updateAction(index, { name: e.target.value })}
                                                    className="w-full max-w-xs"
                                                    placeholder="动作名称"
                                                />
                                            )}
                                            
                                            {action.useExisting ? (
                                                <Tag value="使用已有" severity="success" className="flex-shrink-0" />
                                            ) : (
                                                <Tag value="新建" severity="warning" className="flex-shrink-0" />
                                            )}
                                        </div>
                                        
                                        <Button
                                            label={action.useExisting ? "新建" : "使用已有"}
                                            size="small"
                                            severity="secondary"
                                            text
                                            onClick={() => toggleActionMode(index)}
                                        />
                                    </div>
                                    
                                    {!action.useExisting && action.shouldCreate && (
                                        <div className="flex items-center gap-4 mt-2 ml-8 text-sm">
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <Checkbox
                                                    checked={action.needsAutoCompute}
                                                    onChange={(e) => updateAction(index, { needsAutoCompute: e.checked || false })}
                                                />
                                                <span>自动计算重量</span>
                                            </label>
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <Checkbox
                                                    checked={action.includesBodyWeight}
                                                    onChange={(e) => updateAction(index, { includesBodyWeight: e.checked || false })}
                                                />
                                                <span>包含自重</span>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        
                        <div className="text-sm text-gray-500">
                            将创建 {editableActions.filter(a => !a.useExisting && a.shouldCreate).length} 个新动作
                        </div>
                        
                        <div className="flex justify-between">
                            <Button
                                label="上一步"
                                icon="pi pi-arrow-left"
                                severity="secondary"
                                outlined
                                onClick={() => setActiveStep(0)}
                            />
                            <Button
                                label="确认并生成计划"
                                icon="pi pi-arrow-right"
                                iconPos="right"
                                onClick={handleConfirmActions}
                            />
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <Tag value={`${parsedWeeks} 周`} severity="info" />
                            <Tag value={`${parsedDays.filter(d => d.type === 'training').length} 个训练日`} />
                        </div>
                        <div className="max-h-80 overflow-y-auto border rounded-lg p-3">
                            {parsedDays.map((day, index) => (
                                <div key={index} className="mb-3 p-3 bg-gray-50 rounded">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="font-bold">
                                            W{day.weekIndex}D{day.dayOfWeek}
                                        </span>
                                        <Tag
                                            value={day.type === 'training' ? '训练日' : '休息日'}
                                            severity={day.type === 'training' ? 'success' : 'secondary'}
                                        />
                                    </div>
                                    {day.type === 'training' && day.actions.length > 0 && (
                                        <ul className="text-sm text-gray-600 space-y-1">
                                            {day.actions.map((action, actionIndex) => (
                                                <li key={actionIndex} className="flex gap-2">
                                                    <span>•</span>
                                                    <span>
                                                        {getActionName(action.actionId)}
                                                        {' - '}
                                                        {action.sets}组×{action.reps}次
                                                        {action.intensityConfig?.relativeIntensity && (
                                                            <span className="text-blue-600">
                                                                {' '}
                                                                ({action.intensityConfig.relativeIntensity.value}
                                                                {action.intensityConfig.relativeIntensity.type === 'rm' ? 'RM' : '%'})
                                                            </span>
                                                        )}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {day.dayNote && (
                                        <p className="text-sm text-gray-500 mt-2 italic">{day.dayNote}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between">
                            <Button
                                label="上一步"
                                icon="pi pi-arrow-left"
                                severity="secondary"
                                outlined
                                onClick={() => setActiveStep(1)}
                            />
                            <Button
                                label="导入到计划库"
                                icon="pi pi-check"
                                severity="success"
                                onClick={handleImportPlan}
                            />
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <Dialog
            header="智能导入训练计划"
            visible={visible}
            onHide={handleHide}
            className="w-full max-w-2xl"
            modal
            draggable={false}
        >
            <div className="flex flex-col gap-4">
                <Steps model={steps} activeIndex={activeStep} readOnly />
                
                {error && (
                    <Message severity="error" text={error} className="w-full" />
                )}
                
                {renderStepContent()}
            </div>
        </Dialog>
    );
}

/**
 * 将解析结果转换为学员计划库格式
 * 输出格式与 student_plan_favorites.training_days 兼容
 */
function convertToStudentPlanDays(
    parsedDays: ParsedDay[],
    weeks: number,
    actions: any[]
): any[] {
    const totalDays = weeks * 7;
    const result: any[] = [];

    for (let i = 0; i < totalDays; i++) {
        const weekIndex = Math.floor(i / 7) + 1;
        const dayOfWeek = (i % 7) + 1;
        
        const parsedDay = parsedDays.find(
            d => d.weekIndex === weekIndex && d.dayOfWeek === dayOfWeek
        );

        const dayIndex = i + 1;

        if (parsedDay && parsedDay.type === 'training') {
            result.push({
                dayIndex: dayIndex,
                type: 'training',
                note: parsedDay.dayNote || '',
                actionSets: (parsedDay.actions || []).map((action, idx) => ({
                    action_id: action.actionId,
                    set_name: `动作${idx + 1}`,
                    sets: action.sets,
                    reps: action.reps,
                    rest_seconds: action.restSeconds || 120,
                    intensity: action.intensityConfig?.relativeIntensity?.type === 'rm' 
                        ? `${action.intensityConfig.relativeIntensity.value}RM` 
                        : undefined,
                    note: action.note || '',
                })),
            });
        } else {
            result.push({
                dayIndex: dayIndex,
                type: 'rest',
                note: parsedDay?.dayNote || '',
                actionSets: [],
            });
        }
    }

    return result;
}
