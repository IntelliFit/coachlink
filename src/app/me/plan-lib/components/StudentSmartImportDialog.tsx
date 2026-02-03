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
import { MultiSelect } from 'primereact/multiselect';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { ParsedStudentActionInfo } from '@/app/api/student/plan-lib/parse-actions/entity';

interface StudentSmartImportDialogProps {
    visible: boolean;
    onHide: () => void;
    existingActions: any[];
    onImportComplete: (trainingDays: any[], globalDescription?: string | null) => void;
}

interface Step {
    label: string;
}

function parseChineseWeekNumber(input: string): number | null {
    const map: Record<string, number> = {
        '零': 0,
        '一': 1,
        '二': 2,
        '两': 2,
        '三': 3,
        '四': 4,
        '五': 5,
        '六': 6,
        '七': 7,
        '八': 8,
        '九': 9,
        '十': 10,
    };
    if (/^\d+$/.test(input)) return parseInt(input, 10);
    if (input === '十') return 10;
    if (input.startsWith('十')) {
        const last = map[input.slice(1)] ?? 0;
        return 10 + last;
    }
    if (input.endsWith('十')) {
        const first = map[input[0]] ?? 0;
        return first * 10;
    }
    if (input.includes('十')) {
        const [a, b] = input.split('十');
        const first = map[a] ?? 0;
        const last = map[b] ?? 0;
        return first * 10 + last;
    }
    return map[input] ?? null;
}

function detectWeekMarkers(text: string): number[] {
    const markers = new Set<number>();
    const wdRegex = /W\s*(\d+)\s*D/gi;
    const wRegex = /(?:^|\s|\*|\(|\[)W\s*(\d+)/gi;
    const cnRegex = /第\s*([0-9一二三四五六七八九十两]+)\s*周/g;
    for (const match of text.matchAll(wdRegex)) {
        markers.add(parseInt(match[1], 10));
    }
    for (const match of text.matchAll(wRegex)) {
        markers.add(parseInt(match[1], 10));
    }
    for (const match of text.matchAll(cnRegex)) {
        const num = parseChineseWeekNumber(match[1]);
        if (num) markers.add(num);
    }
    return Array.from(markers).filter((n) => Number.isFinite(n) && n > 0);
}

const steps: Step[] = [
    { label: '输入文本' },
    { label: '确认动作' },
    { label: '预览计划' },
];

async function parseApiResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        const text = await response.text();
        const statusLabel = response.status ? ` (${response.status})` : '';
        throw new Error(`接口返回非 JSON${statusLabel}`);
    }

    const data = await response.json();
    if (!response.ok) {
        const message = (data as any)?.message || `请求失败 (${response.status})`;
        throw new Error(message);
    }
    return data as T;
}

// 可编辑的动作信息
interface EditableAction extends ParsedStudentActionInfo {
    useExisting: boolean;
    selectedExistingId: string | null;
    shouldCreate: boolean;
    positions?: string[];
    detail?: string;
    url?: string;
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
    const [globalDescription, setGlobalDescription] = useState<string>('');
    const [parseWarning, setParseWarning] = useState<string | null>(null);
    
    // 合并后的动作列表（包含新创建的）
    const [allActions, setAllActions] = useState<any[]>([]);

    const actionAttrs = [
        { label: '组数(sets)', value: '组数' },
        { label: '次数(reps)', value: '次数' },
        { label: '持续时间(秒)', value: '持续时间' },
        { label: '强度(RM/%/固定重量)', value: '强度' },
        { label: '休息时间', value: '休息时间' },
    ];

    const actionTypes = [
        { label: '全身', value: '全身' },
        { label: '胸部', value: '胸部' },
        { label: '背部', value: '背部' },
        { label: '腿部', value: '腿部' },
        { label: '肩部', value: '肩部' },
        { label: '手臂', value: '手臂' },
        { label: '核心', value: '核心' },
        { label: '其他', value: '其他' },
    ];

    // 重置状态
    const resetState = useCallback(() => {
        setActiveStep(0);
        setInputText('');
        setIsLoading(false);
        setError(null);
        setEditableActions([]);
        setParsedWeeks(0);
        setParsedDays([]);
        setGlobalDescription('');
        setAllActions([]);
        setParseWarning(null);
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

            const result = await parseApiResponse<any>(response);

            if (!result.success) {
                throw new Error(result.message || '解析失败');
            }

            // 转换为可编辑格式
            const hasExistingOptions = (existingActions || []).length > 0;
            const editable: EditableAction[] = result.data.actions.map((a: ParsedStudentActionInfo) => {
                const canUseExisting = Boolean(a.matchedExistingId);
                return {
                    ...a,
                    useExisting: canUseExisting,
                    selectedExistingId: canUseExisting ? (a.matchedExistingId || null) : null,
                    shouldCreate: !canUseExisting,
                    positions: ["全身"],
                    // 默认不写描述，避免“智能导入”带来的廉价感（需要时用户可手动补充）
                    detail: "",
                    url: "",
                };
            });
            
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
                    attrs: a.attrs,
                    positions: a.positions,
                    detail: a.detail,
                    url: a.url,
                }));

            let createdActions: any[] = [];

            if (actionsToCreate.length > 0) {
                // 使用学员版批量创建 API
                const createResponse = await fetch('/api/student/action-lib/batch-create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ actions: actionsToCreate }),
                });

                const createResult = await parseApiResponse<any>(createResponse);
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

            const templateResult = await parseApiResponse<any>(templateResponse);
            if (!templateResult.success) {
                throw new Error(templateResult.message || '解析计划失败');
            }

            setParsedWeeks(templateResult.data.weeks);
            setParsedDays(templateResult.data.trainingDays);
            setGlobalDescription(templateResult.data.globalDescription || '');
            const weekMarkers = detectWeekMarkers(inputText);
            const parsedWeeksCount = Number(templateResult.data.weeks || 0);
            const maxMarker = weekMarkers.length > 0 ? Math.max(...weekMarkers) : 0;
            if (weekMarkers.length >= 2 && parsedWeeksCount <= 1) {
                setParseWarning('检测到多周标记（如 W1/W2 或 第X周），但只识别出 1 周。建议明确写周标题：W1/W2 或 第1周/第2周，并在每周下用 D1/D2/周一 等标注训练日。');
            } else if (maxMarker > 0 && parsedWeeksCount > 0 && parsedWeeksCount < maxMarker) {
                setParseWarning(`检测到周标记最大为 W${maxMarker}，但只解析出 ${parsedWeeksCount} 周。建议检查周标题是否连续、格式是否为 W# 或 第#周。`);
            } else {
                setParseWarning(null);
            }
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
        onImportComplete(trainingDays, globalDescription || null);
        handleHide();
    };

    // 现有动作下拉选项
    const existingActionOptions = existingActions.map(a => ({
        label: a.name,
        value: a.id,
    }));

    // 为单个动作构造下拉选项（兼容 matchedExistingId 不在列表里的情况）
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
                            请粘贴您的训练计划文本，系统将自动智能解析动作和训练结构。
                        </p>
                        <Message
                            severity="info"
                            text="推荐格式：周标题用 W1/W2 或 第1周/第2周，训练日用 D1/D2 或 周一/周三。每周内容之间空一行更稳。"
                            className="w-full"
                        />
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
                                                    value={action.selectedExistingId ?? action.matchedExistingId ?? null}
                                                    options={buildExistingOptions(action)}
                                                    onChange={(e) => selectExistingAction(index, e.value)}
                                                    placeholder={action.name || "选择已有动作"}
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
                                        <div className="mt-2 ml-8 text-sm flex flex-col gap-3">
                                            <div className="flex flex-wrap items-center gap-4">
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

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs text-gray-500">动作属性（决定计划里要填什么）</span>
                                                    <MultiSelect
                                                        value={action.attrs || []}
                                                        options={actionAttrs}
                                                        onChange={(e) => updateAction(index, { attrs: e.value })}
                                                        placeholder="选择属性"
                                                        display="chip"
                                                        className="w-full"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs text-gray-500">训练部位</span>
                                                    <MultiSelect
                                                        value={action.positions || ["全身"]}
                                                        options={actionTypes}
                                                        onChange={(e) => updateAction(index, { positions: e.value })}
                                                        placeholder="选择部位"
                                                        display="chip"
                                                        className="w-full"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs text-gray-500">描述（可选）</span>
                                                    <InputTextarea
                                                        value={action.detail || ''}
                                                        onChange={(e) => updateAction(index, { detail: e.target.value })}
                                                        rows={2}
                                                        className="w-full"
                                                        placeholder="如：动作要点 / 注意事项"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs text-gray-500">演示视频 URL（可选）</span>
                                                    <InputText
                                                        value={action.url || ''}
                                                        onChange={(e) => updateAction(index, { url: e.target.value })}
                                                        className="w-full"
                                                        placeholder="https://..."
                                                    />
                                                </div>
                                            </div>
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
                        {parseWarning ? (
                            <Message severity="warn" text={parseWarning} className="w-full" />
                        ) : null}
                        {globalDescription?.trim() ? (
                            <Message
                                severity="info"
                                text={`已识别到全局说明（将写入计划“描述”）：${globalDescription.trim().slice(0, 60)}${globalDescription.trim().length > 60 ? '…' : ''}`}
                                className="w-full"
                            />
                        ) : null}
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
                                                        {action.sets}组{typeof action.reps === 'number' ? `×${action.reps}次` : ''}
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
