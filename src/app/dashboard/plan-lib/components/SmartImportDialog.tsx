'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputText } from 'primereact/inputtext';
import { Steps } from 'primereact/steps';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Tag } from 'primereact/tag';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { MultiSelect } from 'primereact/multiselect';
import { CoachActionRow, ItemType } from '@/types';
import { ParsedActionInfo } from '@/app/api/plan-lib/parse-actions/entity';
import { ParsedTemplateDay } from '@/app/api/plan-lib/parse-template/entity';
import { AERO_CARD, AERO_CARD_MUTED, AERO_TITLE, AERO_SUBTITLE } from '@/components/streetlifting-index/aero';

// NOTE: Keep this file client-safe. Do NOT import server-only modules (node:fs, etc).
const SMART_IMPORT_TRACE_HEADER = 'x-smart-import-trace-id';

interface SmartImportDialogProps {
    visible: boolean;
    onHide: () => void;
    existingActions: CoachActionRow[];
    onImportComplete: (trainingDays: any[], globalDescription?: string | null) => void;
    /** 是否将覆盖现有训练日内容（编辑页传入，用于在面板内显示警告） */
    willOverwriteExisting?: boolean;
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
    { label: '预览模板' },
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
interface EditableAction extends ParsedActionInfo {
    // 用户选择：使用现有动作 or 创建新动作
    useExisting: boolean;
    // 如果使用现有动作，选择的动作ID
    selectedExistingId: string | null;
    // 是否需要创建（新动作且被选中）
    shouldCreate: boolean;

    // 仅用于智能导入新建：补充可配置字段（类似动作库添加）
    positions?: string[];
    detail?: string;
    url?: string;
}

export default function SmartImportDialog({
    visible,
    onHide,
    existingActions,
    onImportComplete,
    willOverwriteExisting = false,
}: SmartImportDialogProps) {
    const [activeStep, setActiveStep] = useState(0);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    
    // Step 2: 可编辑的动作列表
    const [editableActions, setEditableActions] = useState<EditableAction[]>([]);
    
    // 当前正在编辑的动作索引
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    
    // Step 3: 解析出的模板
    const [parsedWeeks, setParsedWeeks] = useState(0);
    const [parsedDays, setParsedDays] = useState<ParsedTemplateDay[]>([]);
    const [globalDescription, setGlobalDescription] = useState<string>('');
    const [parseWarning, setParseWarning] = useState<string | null>(null);

    // Trace (auto-generate real cases)
    const traceUiEnabled = process.env.NEXT_PUBLIC_SMART_IMPORT_TRACE === '1';
    const [saveAsCase, setSaveAsCase] = useState(false);
    const [traceId, setTraceId] = useState<string | null>(null);
    const [caseDir, setCaseDir] = useState<string>('');
    
    // 合并后的动作列表（包含新创建的）
    const [allActions, setAllActions] = useState<CoachActionRow[]>([]);

    const generateTraceId = () => {
        // Keep it URL/path safe; server also sanitizes.
        try {
            // @ts-ignore
            return (crypto?.randomUUID?.() as string) || null;
        } catch {
            return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
        }
    };

    const itemTypeOptions = [
        { label: '力量', value: 'STRENGTH' },
        { label: '有氧', value: 'CARDIO' },
        { label: '饮食', value: 'DIET' },
        { label: '习惯', value: 'HABIT' },
    ];

    const attrProfilesByType: Record<ItemType, Array<{
        label: string;
        value: string;
        attrs: string[];
    }>> = {
        STRENGTH: [
            {
                label: '次数型（组数+次数+强度+休息）',
                value: 'STRENGTH_REP',
                attrs: ['组数', '次数', '强度', '休息时间'],
            },
            {
                label: '时长型（组数+时长+强度+休息）',
                value: 'STRENGTH_TIME',
                attrs: ['组数', '持续时间', '强度', '休息时间'],
            },
            {
                label: '恢复型-次数（组数+次数+休息）',
                value: 'STRENGTH_MOBILITY_REP',
                attrs: ['组数', '次数', '休息时间'],
            },
            {
                label: '恢复型-时长（组数+时长+休息）',
                value: 'STRENGTH_MOBILITY_TIME',
                attrs: ['组数', '持续时间', '休息时间'],
            },
        ],
        CARDIO: [
            {
                label: '距离型（距离+配速+时长）',
                value: 'CARDIO_DISTANCE',
                attrs: ['距离', '配速', '持续时间'],
            },
            {
                label: '间歇型（冲刺+间歇+循环+强度）',
                value: 'CARDIO_INTERVAL',
                attrs: ['冲刺时长', '间歇时长', '循环次数', '强度'],
            },
        ],
        DIET: [
            {
                label: '复合摄入（食物+热量+宏量营养）',
                value: 'DIET_MEAL',
                attrs: ['食物清单', '热量', '宏量营养'],
            },
            {
                label: '单一计量（摄入量+时间点）',
                value: 'DIET_SINGLE',
                attrs: ['摄入量', '时间点'],
            },
        ],
        HABIT: [
            {
                label: '统计型（目标数值+完成状态）',
                value: 'HABIT_COUNT',
                attrs: ['目标数值', '完成状态'],
            },
            {
                label: '行为型（完成状态）',
                value: 'HABIT_CHECK',
                attrs: ['完成状态'],
            },
        ],
    };

    const getDefaultAttrsForType = (type?: ItemType) => {
        const t = (type || 'STRENGTH') as ItemType;
        return attrProfilesByType[t]?.[0]?.attrs ?? [];
    };

    const getProfileValueForAttrs = (type?: ItemType, attrs?: string[]) => {
        const t = (type || 'STRENGTH') as ItemType;
        const list = attrProfilesByType[t] || [];
        const current = Array.isArray(attrs) ? attrs : [];
        const match = list.find((p) =>
            p.attrs.length === current.length &&
            p.attrs.every((v, i) => v === current[i]),
        );
        return match?.value ?? null;
    };

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
        setEditingIndex(null);
        setParsedWeeks(0);
        setParsedDays([]);
        setGlobalDescription('');
        setParseWarning(null);
        setSaveAsCase(false);
        setTraceId(null);
        setCaseDir('');
        setAllActions([]);
        setIsDragging(false);
    }, []);

    const handleHide = () => {
        resetState();
        onHide();
    };

    // 从纯文本文件读取（txt/csv/md）
    const readFileAsText = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('读取文件失败'));
            reader.readAsText(file, 'UTF-8');
        });
    };

    const handleFileSelect = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        const ext = (file.name.toLowerCase().split('.').pop() || '').trim();
        const textExts = ['txt', 'csv', 'md'];
        const docExts = ['docx', 'xlsx', 'xls'];
        if (!textExts.includes(ext) && !docExts.includes(ext)) {
            setError('仅支持 .txt、.csv、.md、.docx、.xlsx、.xls 格式');
            return;
        }
        try {
            let text: string;
            if (textExts.includes(ext)) {
                text = await readFileAsText(file);
            } else {
                // Word/Excel：调用后端提取文本
                setIsLoading(true);
                setError(null);
                const formData = new FormData();
                formData.append('file', file);
                const res = await fetch('/api/plan-lib/extract-file-text', {
                    method: 'POST',
                    body: formData,
                });
                const data = await res.json();
                if (!data.success) {
                    throw new Error(data.message || '解析文件失败');
                }
                text = data.data?.text || '';
                setIsLoading(false);
            }
            setInputText(text);
            setError(null);
            // 文件解析成功且文本非空时，自动进入后续步骤（解析动作），无需用户再次点击
            if (text.trim()) {
                await handleParseActions(text);
            }
        } catch (err: any) {
            setError(err.message || '读取文件失败');
            setIsLoading(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => setIsDragging(false);

    // Step 1: 解析动作；可选 overrideText 用于文件上传后立即解析（此时 state 尚未更新）
    const handleParseActions = async (overrideText?: string) => {
        const textToParse = (overrideText ?? inputText).trim();
        if (!textToParse) {
            setError('请输入训练计划文本');
            return;
        }

        // 立刻展示对话框并进入加载态，缓解等待焦虑
        setActiveStep(1);
        setIsLoading(true);
        setError(null);

        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (saveAsCase && traceId) headers[SMART_IMPORT_TRACE_HEADER] = traceId;

            // Stage0: 预检输入完整性，不完整则拦截并提示（预检失败时仍允许继续尝试解析）
            try {
                const preflightRes = await fetch('/api/plan-lib/smart-import/preflight', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: textToParse }),
                });
                const preflightData = await parseApiResponse<any>(preflightRes);
                if (preflightData?.success && preflightData?.data) {
                    const { isComplete, canProceed, userMessage } = preflightData.data;
                    if (!isComplete || !canProceed) {
                        setError(userMessage || '信息不完整，请补充训练计划内容后再试');
                        setIsLoading(false);
                        return;
                    }
                }
            } catch (_preflightErr) {
                // 预检服务异常时不阻断，继续尝试解析
            }

            const response = await fetch('/api/plan-lib/parse-actions', {
                method: 'POST',
                headers,
                body: JSON.stringify({ text: textToParse }),
            });

            const result = await parseApiResponse<any>(response);

            if (!result.success) {
                throw new Error(result.message || '解析失败');
            }

            // 转换为可编辑格式
            const editable: EditableAction[] = result.data.actions.map((a: ParsedActionInfo) => {
                // 只有真正匹配到已有动作时，才默认“使用已有”
                // 未匹配到 → 默认“新建”（用户可手动切换为“使用已有”并映射到其他动作）
                const canUseExisting = Boolean(a.matchedExistingId);
                const nextType = ((a as any).type || 'STRENGTH') as ItemType;
                const nextAttrs = Array.isArray(a.attrs) && a.attrs.length > 0
                    ? a.attrs
                    : getDefaultAttrsForType(nextType);
                return {
                    ...a,
                    type: nextType,
                    attrs: nextAttrs,
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

    const updateActionType = (index: number, nextType: ItemType) => {
        const defaultAttrs = getDefaultAttrsForType(nextType);
        updateAction(index, {
            type: nextType,
            attrs: defaultAttrs,
            needsAutoCompute: nextType === 'STRENGTH'
                ? editableActions[index]?.needsAutoCompute || false
                : false,
            includesBodyWeight: nextType === 'STRENGTH'
                ? editableActions[index]?.includesBodyWeight || false
                : false,
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
            const nextType = (selectedAction.type || 'STRENGTH') as ItemType;
            updateAction(index, {
                selectedExistingId: actionId,
                matchedExistingId: actionId,
                // 同步现有动作的属性
                type: nextType,
                attrs: selectedAction.attrs?.length
                    ? selectedAction.attrs
                    : getDefaultAttrsForType(nextType),
                needsAutoCompute: nextType === 'STRENGTH'
                    ? (selectedAction.enableAutoWeightCompute || false)
                    : false,
                includesBodyWeight: nextType === 'STRENGTH'
                    ? (selectedAction.includesBodyWeight || false)
                    : false,
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
                    type: a.type || 'STRENGTH',
                }));

            let createdActions: CoachActionRow[] = [];

            if (actionsToCreate.length > 0) {
                // 批量创建新动作
                const createResponse = await fetch('/api/plan-lib/batch-create-actions', {
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

            // 调用解析模板 API
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (saveAsCase && traceId) headers[SMART_IMPORT_TRACE_HEADER] = traceId;
            const templateResponse = await fetch('/api/plan-lib/parse-template', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    text: inputText,
                    // 传递 attrs 让模型知道哪些动作是按“持续时间”计量
                    actions: mergedActions,
                }),
            });

            const templateResult = await parseApiResponse<any>(templateResponse);
            if (!templateResult.success) {
                throw new Error(templateResult.message || '解析模板失败');
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

            // Finalize trace: persist what the UI saw (non-blocking)
            if (saveAsCase && traceId) {
                try {
                    const convertedTrainingDays = convertToTemplateDays(
                        templateResult.data.trainingDays,
                        templateResult.data.weeks,
                        mergedActions,
                    );
                    const finalizeRes = await fetch(
                        '/api/plan-lib/smart-import/finalize-trace',
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                traceId,
                                uiSnapshot: {
                                    capturedAt: new Date().toISOString(),
                                    inputText,
                                    editableActions,
                                    mergedActions,
                                    templateResult: templateResult.data,
                                    convertedTrainingDays,
                                },
                            }),
                        },
                    );
                    const finalizeData = await parseApiResponse<any>(finalizeRes);
                    if (finalizeData?.success && finalizeData?.data?.caseDir) {
                        setCaseDir(finalizeData.data.caseDir);
                    }
                } catch (e) {
                    // ignore
                }
            }
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
        onImportComplete(trainingDays, globalDescription || null);
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

    // 渲染步骤内容（仅 step 1、2 及 loading）
    const isLoadingParsing = isLoading && editableActions.length === 0;
    const isLoadingGenerating = isLoading && editableActions.length > 0;
    const renderStepContent = () => {
        if (isLoading) {
            const loadingMessage = isLoadingParsing ? 'AI 正在解析动作...' : '正在生成模板...';
            return (
                <div className="flex flex-col items-center justify-center py-20">
                    <ProgressSpinner style={{ width: '56px', height: '56px' }} className="text-primary-500" />
                    <p className="mt-5 text-sm font-bold text-surface-700 dark:text-surface-300">{loadingMessage}</p>
                    <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">请稍候，无需重复操作</p>
                </div>
            );
        }

        switch (activeStep) {
            case 0:
                return null;

            case 1:
                return (
                    <div className="flex flex-col gap-3">
                        <div className={`divide-y divide-surface-100 p-0`}>
                            {editableActions.map((action, index) => (
                                <div
                                    key={index}
                                    className="px-2.5 py-2 smart-import-step-entry"
                                    style={{ animationDelay: `${index * 30}ms` }}
                                >
                                    {/* 主行：动作信息（紧凑） */}
                                    <div className="flex items-center justify-between gap-1.5">
                                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                            {action.useExisting ? (
                                                <i className="pi pi-link text-primary-500 flex-shrink-0 text-xs" />
                                            ) : (
                                                <Checkbox
                                                    checked={action.shouldCreate}
                                                    onChange={(e) => updateAction(index, { shouldCreate: e.checked || false })}
                                                    className="[&_.p-checkbox-box]:w-3.5 [&_.p-checkbox-box]:h-3.5"
                                                />
                                            )}
                                            {action.useExisting ? (
                                                <Dropdown
                                                    value={action.selectedExistingId ?? action.matchedExistingId ?? null}
                                                    options={buildExistingOptions(action)}
                                                    onChange={(e) => selectExistingAction(index, e.value)}
                                                    placeholder={action.name || "选择已有动作"}
                                                    className="flex-1 min-w-0 max-w-[200px] aero-dropdown [&_.p-dropdown-label]:text-xs [&_.p-dropdown-label]:py-2"
                                                    panelClassName="aero-dropdown-panel"
                                                    filter
                                                    filterPlaceholder="搜索..."
                                                />
                                            ) : (
                                                <InputText
                                                    value={action.name}
                                                    onChange={(e) => updateAction(index, { name: e.target.value })}
                                                    className="flex-1 min-w-0 max-w-[180px] text-xs py-1.5 px-2 rounded-xl border-surface-200"
                                                    placeholder="动作名称"
                                                />
                                            )}
                                            <span className={`text-[10px] font-bold px-1.5 py-px rounded-md shrink-0 ${action.useExisting ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                                {action.useExisting ? '已有' : '新建'}
                                            </span>
                                        </div>
                                        <Button
                                            label={action.useExisting ? '新建' : '已有'}
                                            size="small"
                                            severity="secondary"
                                            text
                                            className="rounded-lg text-[11px] font-bold h-7 px-2"
                                            onClick={() => toggleActionMode(index)}
                                        />
                                    </div>
                                    {/* 属性行：仅新建动作显示（紧凑，与描述/URL 等表单项高度、宽度一致） */}
                                    {!action.useExisting && action.shouldCreate && (
                                        <div className="mt-1.5 ml-5 flex flex-col gap-2 text-xs">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <div className="flex flex-col gap-0.5 min-w-0">
                                                    <span className="text-[10px] text-surface-500">类型</span>
                                                    <Dropdown
                                                        value={(action.type || 'STRENGTH') as ItemType}
                                                        options={itemTypeOptions}
                                                        onChange={(e) => updateActionType(index, e.value)}
                                                        className="w-full max-w-[180px] aero-dropdown smart-import-dropdown-compact"
                                                        panelClassName="aero-dropdown-panel"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-0.5 min-w-0">
                                                    <span className="text-[10px] text-surface-500">属性</span>
                                                    <Dropdown
                                                        value={getProfileValueForAttrs(action.type as ItemType, action.attrs)}
                                                        options={attrProfilesByType[(action.type || 'STRENGTH') as ItemType]}
                                                        onChange={(e) => {
                                                            const list = attrProfilesByType[(action.type || 'STRENGTH') as ItemType] || [];
                                                            const profile = list.find((p) => p.value === e.value);
                                                            if (profile) updateAction(index, { attrs: profile.attrs });
                                                        }}
                                                        placeholder="模板"
                                                        className="w-full max-w-[180px] aero-dropdown smart-import-dropdown-compact"
                                                        panelClassName="aero-dropdown-panel"
                                                    />
                                                </div>
                                            </div>
                                            {action.type === 'STRENGTH' && (
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <label className="flex items-center gap-1 cursor-pointer">
                                                        <Checkbox
                                                            checked={action.needsAutoCompute}
                                                            onChange={(e) => updateAction(index, { needsAutoCompute: e.checked || false })}
                                                            className="[&_.p-checkbox-box]:w-3.5 [&_.p-checkbox-box]:h-3.5"
                                                        />
                                                        <span className="text-[11px] text-surface-600 dark:text-surface-400">自动重量</span>
                                                    </label>
                                                    <label className="flex items-center gap-1 cursor-pointer">
                                                        <Checkbox
                                                            checked={action.includesBodyWeight}
                                                            onChange={(e) => updateAction(index, { includesBodyWeight: e.checked || false })}
                                                            className="[&_.p-checkbox-box]:w-3.5 [&_.p-checkbox-box]:h-3.5"
                                                        />
                                                        <span className="text-[11px] text-surface-600 dark:text-surface-400">自重</span>
                                                    </label>
                                                    <MultiSelect
                                                        value={action.positions || ["全身"]}
                                                        options={actionTypes}
                                                        onChange={(e) => updateAction(index, { positions: e.value })}
                                                        placeholder="部位"
                                                        display="chip"
                                                        className="smart-import-multiselect-compact"
                                                        panelClassName="smart-import-multiselect-compact-panel"
                                                    />
                                                </div>
                                            )}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <InputTextarea
                                                    value={action.detail || ''}
                                                    onChange={(e) => updateAction(index, { detail: e.target.value })}
                                                    rows={1}
                                                    className="w-full text-xs py-1.5 px-2 rounded-xl resize-none"
                                                    placeholder="描述（可选）"
                                                />
                                                <InputText
                                                    value={action.url || ''}
                                                    onChange={(e) => updateAction(index, { url: e.target.value })}
                                                    className="w-full text-xs py-1.5 px-2 rounded-xl"
                                                    placeholder="视频 URL（可选）"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="text-[11px] text-surface-500 font-bold">
                            将创建 {editableActions.filter(a => !a.useExisting && a.shouldCreate).length} 个新动作
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="flex flex-col h-full min-h-0 w-full">
                        <div className="shrink-0 px-4 pt-3 pb-2 space-y-1.5">
                            {parseWarning ? (
                                <div className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed border-l-2 border-amber-500 pl-3 py-0.5">
                                    {parseWarning}
                                </div>
                            ) : null}
                            {globalDescription?.trim() ? (
                                <div className="text-xs text-surface-600 dark:text-surface-400 leading-relaxed border-l-2 border-primary-500 pl-3 py-0.5">
                                    已识别到全局说明（将写入计划「详情描述」）：{globalDescription.trim().slice(0, 60)}{globalDescription.trim().length > 60 ? '…' : ''}
                                </div>
                            ) : null}
                            <div className="flex items-center gap-2">
                                <Tag value={`${parsedWeeks} 周`} severity="info" className="rounded-lg text-xs" />
                                <Tag value={`${parsedDays.filter(d => d.type === 'training').length} 个训练日`} className="rounded-lg text-xs" />
                            </div>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-surface-50 dark:bg-surface-800/30">
                            {parsedDays.map((day, index) => (
                                <div key={index} className="p-3 border-b border-surface-100 dark:border-surface-700 last:border-b-0 smart-import-step-entry bg-surface-0 dark:bg-surface-900">
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
                                        <ul className="text-sm text-surface-600 dark:text-surface-400 space-y-1">
                                            {day.actions.map((action, actionIndex) => (
                                                <li key={actionIndex} className="flex gap-2">
                                                    <span>•</span>
                                                    <span>
                                                        {getActionName(action.actionId, allActions)}
                                                        {' - '}
                                                        {getActionType(action.actionId, allActions) !== 'STRENGTH'
                                                            ? formatCustomDataSummary((action as any).customData)
                                                            : (
                                                                <>
                                                                    {typeof action.sets === 'number' ? `${action.sets}组` : ''}
                                                                    {typeof (action as any).durationSeconds === 'number'
                                                                        ? `×${(action as any).durationSeconds}秒`
                                                                        : (typeof action.reps === 'number'
                                                                            ? `×${action.reps}次`
                                                                            : (typeof action.sets === 'number' ? `×自选` : '')
                                                                        )
                                                                    }
                                                                    {action.intensityConfig?.relativeIntensity && (
                                                                        <span className="text-primary-600 dark:text-primary-400">
                                                                            {' '}
                                                                            ({action.intensityConfig.relativeIntensity.value}
                                                                            {action.intensityConfig.relativeIntensity.type === 'rm' ? 'RM' : '%'})
                                                                        </span>
                                                                    )}
                                                                </>
                                                            )
                                                        }
                                                        {action.note ? (
                                                            <span className="text-surface-500">
                                                                {' '}
                                                                [{action.note}]
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {day.dayNote && (
                                        <p className="text-sm text-surface-500 mt-2 italic">{day.dayNote}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    const exampleChips = [
        { label: '周标题', text: 'W1/W2 或 第1周/第2周', icon: 'pi-calendar' },
        { label: '训练日', text: 'D1/D2 或 周一/周三', icon: 'pi-list' },
        { label: '格式', text: '每周内容之间空一行', icon: 'pi-info-circle' },
    ];

    if (!visible) return null;

    // 步骤 0：右侧滑入面板（输入/上传）
    // 步骤 1+：居中宽幅对话框（确认动作、预览模板）
    const showStep0Panel = activeStep === 0;
    const showStepsDialog = visible && activeStep >= 1;

    return (
        <>
            {/* 步骤 0：背景遮罩 + 右侧滑入面板 */}
            {showStep0Panel && (
                <>
                    <div
                        className="fixed inset-0 bg-black/30 z-[9998] transition-opacity duration-[250ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]"
                        onClick={handleHide}
                        aria-hidden="true"
                    />
                    <div
                        className="fixed right-0 top-0 bottom-0 w-full max-w-[480px] bg-white dark:bg-surface-900 shadow-2xl z-[9999] flex flex-col smart-import-panel-enter"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="smart-import-title"
                    >
                <div className="flex flex-col h-full overflow-hidden">
                    {/* 覆盖警告（编辑页且现有内容时显示） */}
                    {willOverwriteExisting && (
                        <div className="shrink-0 mx-4 mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/25 border border-amber-200 dark:border-amber-700/50 text-sm text-amber-800 dark:text-amber-200">
                            <i className="pi pi-exclamation-triangle mr-2" />
                            AI 智能导入将覆盖当前模板的所有训练日内容
                        </div>
                    )}
                    {/* Step 0: 顶部文本框 + 中部拖拽区 */}
                    {activeStep === 0 && (
                        <div className="flex-1 flex flex-col min-h-0 px-6 py-5">
                            {/* 标题栏 */}
                            <div className="flex items-center justify-between shrink-0 mb-4">
                                <h2 id="smart-import-title" className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                                    AI 智能导入
                                </h2>
                                <Button
                                    icon="pi pi-times"
                                    text
                                    severity="secondary"
                                    className="w-9 h-9 rounded-lg text-surface-600 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800"
                                    onClick={handleHide}
                                    disabled={isLoading}
                                    aria-label="关闭"
                                />
                            </div>

                            {/* 上方：文本框 */}
                            <div className="shrink-0 space-y-2 mb-4">
                                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                                    粘贴训练计划文本
                                </label>
                                <InputTextarea
                                    value={inputText}
                                    onChange={(e) => { setInputText(e.target.value); setError(null); }}
                                    rows={4}
                                    placeholder={`示例格式：\nW1 D1\n70%rm 4*4 负重引体 rpe9 组间60s\n\nD2\n反握引体 70% 4*4 rpe8\n\n**休息1天**\n- 拉伸、松解`}
                                    className="w-full font-mono text-sm rounded-xl border-surface-200 focus:border-primary-500 resize-none"
                                />
                            </div>

                            {/* 中间：大拖拽/点击选文件区域 */}
                            <div className="flex-1 min-h-[180px] flex flex-col">
                                <label className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                                    或上传文件
                                </label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".txt,.csv,.md,.docx,.xlsx,.xls"
                                    className="hidden"
                                    onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ''; }}
                                />
                                <div
                                    className={`flex-1 min-h-[160px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 px-4 transition-colors cursor-pointer ${
                                        isDragging
                                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                            : 'border-surface-300 hover:border-surface-400 hover:bg-surface-50 dark:border-surface-600 dark:hover:border-surface-500 dark:hover:bg-surface-800/50'
                                    }`}
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <i className="pi pi-cloud-upload text-3xl text-surface-500 dark:text-surface-400" />
                                    <span className="text-sm text-surface-600 dark:text-surface-400">
                                        拖拽文件到此处，或点击选择
                                    </span>
                                    <span className="text-xs text-surface-400 dark:text-surface-500">
                                        支持 .txt、.csv、.md、.docx、.xlsx、.xls
                                    </span>
                                </div>
                                {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                            </div>

                            {/* 解析按钮（trace 模式下为 ButtonGroup：保存为测试样例 + 运行） */}
                            <div className="shrink-0 pt-4">
                                {traceUiEnabled ? (
                                    <>
                                        <div className="flex w-full rounded-xl overflow-hidden [&>button]:flex-1 [&>button]:rounded-none [&>button:first-child]:rounded-l-xl [&>button:last-child]:rounded-r-xl [&>button:not(:last-child)]:border-r [&>button:not(:last-child)]:border-surface-200 dark:[&>button:not(:last-child)]:border-surface-600">
                                            <Button
                                                label="保存为测试样例"
                                                icon={saveAsCase ? 'pi pi-check' : 'pi pi-save'}
                                                severity={saveAsCase ? 'success' : 'secondary'}
                                                outlined={!saveAsCase}
                                                onClick={() => {
                                                    const next = !saveAsCase;
                                                    setSaveAsCase(next);
                                                    if (next) setTraceId(generateTraceId());
                                                    else { setTraceId(null); setCaseDir(''); }
                                                }}
                                            />
                                            <Button
                                                label={isLoading ? '解析中...' : '运行'}
                                                icon={isLoading ? 'pi pi-spin pi-spinner' : 'pi pi-play'}
                                                iconPos="right"
                                                onClick={() => handleParseActions()}
                                                disabled={!inputText.trim() || isLoading}
                                            />
                                        </div>
                                        {(saveAsCase && traceId) && (
                                            <div className="text-[10px] text-surface-500 font-mono break-all mt-1.5">traceId: {traceId}</div>
                                        )}
                                        {caseDir && (
                                            <div className="text-[10px] text-surface-500 font-mono break-all mt-0.5">已生成: {caseDir}</div>
                                        )}
                                    </>
                                ) : (
                                    <Button
                                        label={isLoading ? '解析中...' : '解析并导入'}
                                        icon={isLoading ? 'pi pi-spin pi-spinner' : 'pi pi-arrow-right'}
                                        iconPos="right"
                                        className="w-full rounded-xl"
                                        onClick={() => handleParseActions()}
                                        disabled={!inputText.trim() || isLoading}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
                </>
            )}

            {/* 步骤 1+：居中宽幅对话框（确认动作、预览模板），风格对齐 streetlifting-index */}
            <Dialog
                visible={showStepsDialog}
                onHide={handleHide}
                header={
                    <div className="flex items-center justify-between gap-4 w-full">
                        <Button
                            icon="pi pi-arrow-left"
                            text
                            severity="secondary"
                            className="rounded-2xl text-surface-600 hover:text-surface-900 hover:bg-surface-50 dark:hover:bg-surface-800 active:scale-[0.98] transition-all -ml-1"
                            onClick={() => setActiveStep(activeStep - 1)}
                            disabled={isLoading}
                            aria-label="上一步"
                        />
                        <Steps model={steps} activeIndex={activeStep} className="flex-1 justify-center min-w-0 [&_.p-steps-item]:flex-1 [&_.p-steps-title]:text-xs [&_.p-steps-number]:rounded-xl [&_.p-steps-number]:w-8 [&_.p-steps-number]:h-8" />
                        <Button
                            icon="pi pi-times"
                            text
                            severity="secondary"
                            className="w-10 h-10 rounded-2xl text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 shrink-0"
                            onClick={handleHide}
                            aria-label="关闭"
                        />
                    </div>
                }
                modal
                blockScroll
                dismissableMask
                closable={false}
                style={{ width: '92vw', maxWidth: '960px', height: '85vh' }}
                contentStyle={{ padding: 0 }}
                className="batch-operation-dialog smart-import-steps-dialog"
                footer={
                    <div className="flex justify-between items-center w-full">
                        <Button
                            label="上一步"
                            icon="pi pi-arrow-left"
                            text
                            severity="secondary"
                            className="rounded-2xl text-surface-600 hover:text-surface-900 hover:bg-surface-50 dark:hover:bg-surface-800 active:scale-[0.98] transition-all text-sm font-black"
                            onClick={() => setActiveStep(activeStep - 1)}
                            disabled={isLoading}
                        />
                        <div className="flex gap-2">
                            {activeStep === 1 && (
                                <Button
                                    label="确认并生成模板"
                                    icon="pi pi-arrow-right"
                                    iconPos="right"
                                    className="rounded-2xl px-5 h-10 bg-surface-900 dark:bg-surface-0 border-none text-surface-0 dark:text-surface-900 text-sm font-black hover:opacity-90 active:scale-[0.98] transition-all shadow-sm"
                                    onClick={handleConfirmActions}
                                    disabled={isLoading}
                                    loading={isLoading}
                                />
                            )}
                            {activeStep === 2 && (
                                <Button
                                    label="导入到模板"
                                    icon="pi pi-check"
                                    className="rounded-2xl px-5 h-10 bg-surface-900 dark:bg-surface-0 border-none text-surface-0 dark:text-surface-900 text-sm font-black hover:opacity-90 active:scale-[0.98] transition-all shadow-sm"
                                    onClick={handleImportTemplate}
                                />
                            )}
                        </div>
                    </div>
                }
            >
                <div className={`max-h-[75vh] p-0`}>
                    {error && (
                        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800/30 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
                            {error}
                        </div>
                    )}
                    {renderStepContent()}
                </div>
            </Dialog>
        </>
    );
}

// 辅助函数：获取动作名称
function getActionName(actionId: string, actions: CoachActionRow[]): string {
    const action = actions.find(a => a.id === actionId);
    return action?.name || '未知动作';
}

function getActionType(actionId: string, actions: CoachActionRow[]): ItemType {
    const action = actions.find(a => a.id === actionId);
    return (action?.type || 'STRENGTH') as ItemType;
}

function formatCustomDataSummary(customData?: any): string {
    if (!customData) return '（无结构化信息）';
    const parts: string[] = [];
    if (typeof customData.distance === 'number') {
        parts.push(`${(customData.distance / 1000).toFixed(1)}km`);
    }
    if (typeof customData.duration === 'number') {
        parts.push(`${Math.round(customData.duration / 60)}分钟`);
    }
    if (customData.pace) {
        parts.push(`配速${customData.pace}`);
    }
    if (customData.content) {
        parts.push(customData.content);
    }
    if (typeof customData.calories === 'number') {
        parts.push(`${customData.calories}kcal`);
    }
    if (typeof customData.target_duration === 'number') {
        parts.push(`目标${customData.target_duration}分钟`);
    }
    return parts.length > 0 ? parts.join(' · ') : '（无结构化信息）';
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
                    const actionType = getActionType(action.actionId, actions);
                    if (actionType !== 'STRENGTH') {
                        return {
                            type: 'no-filter',
                            actionId: action.actionId || '',
                            setName: `动作${idx + 1}`,
                            itemType: actionType,
                            params: {
                                custom_data: (action as any).customData || {},
                                note: action.note || '',
                            },
                        };
                    }
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
                        itemType: 'STRENGTH',
                        params: {
                            // 使用中文字段名，与 action.attrs 对应
                            '组数': action.sets ?? '',
                            '次数': action.reps ?? '',
                            '持续时间': (action as any).durationSeconds ?? '',
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
