'use client';

import React, { useState, useCallback } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputText } from 'primereact/inputtext';
import { Steps } from 'primereact/steps';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Tag } from 'primereact/tag';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { Message } from 'primereact/message';
import { CoachActionRow } from '@/types';
import { ParsedActionInfo } from '@/app/api/plan-lib/parse-actions/entity';
import { ParsedTemplateDay } from '@/app/api/plan-lib/parse-template/entity';

interface SmartImportDialogProps {
    visible: boolean;
    onHide: () => void;
    existingActions: CoachActionRow[];
    onImportComplete: (trainingDays: any[]) => void;
}

interface Step {
    label: string;
}

const steps: Step[] = [
    { label: '输入文本' },
    { label: '确认动作' },
    { label: '预览模板' },
];

// 可编辑的动作信息
interface EditableAction extends ParsedActionInfo {
    // 用户选择：使用现有动作 or 创建新动作
    useExisting: boolean;
    // 如果使用现有动作，选择的动作ID
    selectedExistingId: string | null;
    // 是否需要创建（新动作且被选中）
    shouldCreate: boolean;
}

export default function SmartImportDialog({
    visible,
    onHide,
    existingActions,
    onImportComplete,
}: SmartImportDialogProps) {
    const [activeStep, setActiveStep] = useState(0);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Step 2: 可编辑的动作列表
    const [editableActions, setEditableActions] = useState<EditableAction[]>([]);
    
    // 当前正在编辑的动作索引
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    
    // Step 3: 解析出的模板
    const [parsedWeeks, setParsedWeeks] = useState(0);
    const [parsedDays, setParsedDays] = useState<ParsedTemplateDay[]>([]);
    
    // 合并后的动作列表（包含新创建的）
    const [allActions, setAllActions] = useState<CoachActionRow[]>([]);

    // 重置状态
    const resetState = useCallback(() => {
        setActiveStep(0);
        setInputText('');
        setIsLoading(false);
        setError(null);
        setEditableActions([]);
        setEditingIndex(null);
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
            const response = await fetch('/api/plan-lib/parse-actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: inputText }),
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || '解析失败');
            }

            // 转换为可编辑格式
            const editable: EditableAction[] = result.data.actions.map((a: ParsedActionInfo) => ({
                ...a,
                useExisting: !a.isNew,
                selectedExistingId: a.matchedExistingId || null,
                shouldCreate: a.isNew, // 默认新动作都要创建
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
            // 切换到创建新动作模式
            updateAction(index, {
                useExisting: false,
                selectedExistingId: null,
                shouldCreate: true,
            });
        } else {
            // 切换到使用现有动作模式
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
                // 同步现有动作的属性
                needsAutoCompute: selectedAction.enableAutoWeightCompute || false,
                includesBodyWeight: selectedAction.includesBodyWeight || false,
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

            let createdActions: CoachActionRow[] = [];

            if (actionsToCreate.length > 0) {
                // 批量创建新动作
                const createResponse = await fetch('/api/plan-lib/batch-create-actions', {
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

            // 调用解析模板 API
            const templateResponse = await fetch('/api/plan-lib/parse-template', {
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
                throw new Error(templateResult.message || '解析模板失败');
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

    // Step 3: 导入模板
    const handleImportTemplate = () => {
        // 将解析的数据转换为模板编辑器需要的格式
        const trainingDays = convertToTemplateDays(parsedDays, parsedWeeks, allActions);
        onImportComplete(trainingDays);
        handleHide();
    };

    // 现有动作下拉选项
    const existingActionOptions = existingActions.map(a => ({
        label: a.name,
        value: a.id,
    }));

    // 为单个动作构造下拉选项，包含已有动作库与可能未在库中的匹配ID
    const buildExistingOptions = (action: EditableAction) => {
        const base = [...existingActionOptions];
        if (
            action.matchedExistingId &&
            !base.find(o => o.value === action.matchedExistingId)
        ) {
            base.unshift({
                label: action.name,
                value: action.matchedExistingId,
            });
        }
        return base;
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
                            请粘贴您的训练计划文本，系统将自动智能解析动作和训练结构。
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
                                    {/* 主行：动作信息 */}
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
                                                // 使用现有动作：显示下拉选择
                                                <Dropdown
                                                    value={action.selectedExistingId ?? action.matchedExistingId ?? null}
                                                    options={buildExistingOptions(action)}
                                                    onChange={(e) => selectExistingAction(index, e.value)}
                                                    placeholder={action.matchedExistingId ? action.name : "选择已有动作"}
                                                    className="w-full max-w-xs"
                                                    filter
                                                    filterPlaceholder="搜索动作..."
                                                />
                                            ) : (
                                                // 创建新动作：显示动作名称（可编辑）
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
                                    
                                    {/* 属性行：仅新建动作显示 */}
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
                                label="确认并生成模板"
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
                                                        {getActionName(action.actionId, allActions)}
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
                                label="导入到模板"
                                icon="pi pi-check"
                                severity="success"
                                onClick={handleImportTemplate}
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
            style={{ width: '700px' }}
            modal
            draggable={false}
            resizable={false}
        >
            <div className="flex flex-col gap-4">
                <Steps
                    model={steps}
                    activeIndex={activeStep}
                    className="mb-4"
                />
                
                {error && (
                    <Message severity="error" text={error} className="w-full" />
                )}

                {renderStepContent()}
            </div>
        </Dialog>
    );
}

// 辅助函数：获取动作名称
function getActionName(actionId: string, actions: CoachActionRow[]): string {
    const action = actions.find(a => a.id === actionId);
    return action?.name || '未知动作';
}

// 辅助函数：将解析结果转换为模板编辑器格式
function convertToTemplateDays(
    parsedDays: ParsedTemplateDay[],
    weeks: number,
    actions: CoachActionRow[]
): any[] {
    // 创建完整的周×7天结构
    const totalDays = weeks * 7;
    const result: any[] = [];

    for (let i = 0; i < totalDays; i++) {
        const weekIndex = Math.floor(i / 7) + 1;
        const dayOfWeek = (i % 7) + 1;
        
        // 查找对应的解析结果
        const parsedDay = parsedDays.find(
            d => d.weekIndex === weekIndex && d.dayOfWeek === dayOfWeek
        );

        // dayIndex 使用 1-based 索引 (1, 2, 3...)
        const dayIndex = i + 1;

        if (parsedDay && parsedDay.type === 'training') {
            result.push({
                dayIndex: dayIndex,
                type: 'training',
                note: parsedDay.dayNote || '',
                actionSets: (parsedDay.actions && parsedDay.actions.length > 0
                    ? parsedDay.actions
                    : [{ actionId: '', sets: null, reps: null, restSeconds: 180, intensityConfig: null, note: '自动解析未给出动作，请选择动作' }]
                ).map((action, idx) => {
                    const ic = action.intensityConfig;
                    let intensityValue: string | number = '';
                    let loadValue: number | null = null;
                    
                    if (ic) {
                        // 处理相对强度 (RM 或百分比)
                        if (ic.relativeIntensity) {
                            intensityValue = ic.relativeIntensity.value;
                        }
                        // 处理固定重量 - 直接设置到 load 字段
                        if ((ic as any).fixedWeight) {
                            const fw = (ic as any).fixedWeight;
                            loadValue = typeof fw === 'object' ? fw.value : fw;
                        }
                    }
                    
                    return {
                        type: 'no-filter',
                        actionId: action.actionId || '',
                        setName: `动作${idx + 1}`,
                        params: {
                            // 使用中文字段名，与 action.attrs 对应
                            '组数': action.sets ?? '',
                            '次数': action.reps ?? '',
                            '休息时间': action.restSeconds ?? 180,
                            '强度': intensityValue,
                            // 如果有固定重量，直接设置 load
                            load: loadValue,
                            intensityConfig: action.intensityConfig || null,
                            note: action.note || '',
                        },
                    };
                }),
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
