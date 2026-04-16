'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';

function useIsDesktop() {
    const [isDesktop, setIsDesktop] = useState(false);
    useEffect(() => {
        const mql = window.matchMedia('(min-width: 768px)');
        setIsDesktop(mql.matches);
        const handler = () => setIsDesktop(mql.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, []);
    return isDesktop;
}
import { Dialog } from 'primereact/dialog';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { BatchOperationService } from '@/app/service/batchOperationService';
import {
    SSEMessage,
    ModificationDiff,
    ConversationTurn,
    PendingActionCandidate,
    BatchOperationContextOptions,
} from '@/app/api/plan-lib/batch-operation/entity';
import MarkdownIt from 'markdown-it';
import type { CoachActionRow, ItemType } from '@/types';

let DOMPurify: any;
if (typeof window !== 'undefined') {
    DOMPurify = require('dompurify').default || require('dompurify');
}

interface BatchOperationDialogProps {
    visible: boolean;
    onHide: () => void;
    templateId?: string;
    mode?: 'template' | 'local';
    targetActionType?: 'coach' | 'student';
    initialTrainingDays?: any[];
    onApplyLocal?: (updatedTrainingDays: any[]) => void;
    existingActions?: CoachActionRow[];
    onSuccess?: () => void;
    /** modal=弹窗 panel=右侧面板 auto=桌面用面板/移动用弹窗 */
    variant?: 'modal' | 'panel' | 'auto';
    /** 收到 preview_result 时回调，用于在左侧编辑器中展示修改并高亮 */
    onPreviewResult?: (data: { originalTrainingDays: any; updatedTrainingDays: any; modifications: ModificationDiff[] }) => void;
    /** 用户点击「取消」时回调，用于恢复左侧编辑器为原始数据 */
    onRestart?: () => void;
    /** 确认应用时，优先使用此函数返回的 days（左侧编辑器的当前数据） */
    onGetDaysToApply?: () => any[] | null;
    /** 预填写的指令文本（如学员反馈汇总），打开时自动填入 */
    initialInstruction?: string;
    /** 传递给后端的上下文增强配置 */
    contextOptions?: BatchOperationContextOptions;
}

type ContextToggleState = {
    includePlanBody: boolean;
    includeActionLibrary: boolean;
    includeStudentProfile: boolean;
    includeStudentQuestionnaire: boolean;
    includeExecutionHistory: boolean;
    includeStudentActionLib: boolean;
    includeCoachActionLib: boolean;
    includePublicActionLib: boolean;
    includeCoachTemplates: boolean;
    includeTemplateMatch: boolean;
    includeFeedbacks: boolean;
};

interface LogEntry {
    type: 'progress' | 'action_plan' | 'stats' | 'error' | 'success' | 'need_clarification' | 'new_actions' | 'user_message' | 'ai_response';
    content: string;
    timestamp: Date;
    data?: any;
}

type AIInputSnapshot = {
    fixedInjected: string[];
    baselineEnabledContext: string[];
    currentEnabledContext: string[];
    addedByContextToggle: string[];
    baselineContextPrompt: string;
    currentContextPrompt: string;
    fullPrompts?: {
        intentPrompt: string;
        queryPrompt: string;
        clarificationPrompt: string;
        systemPrompt: string;
    };
};

interface PendingActionResolution {
    mode: 'use_existing' | 'create_new';
    existingActionId: string | null;
    createPayload: {
        name: string;
        type: ItemType;
        attrs: string[];
        needsAutoCompute: boolean;
        includesBodyWeight: boolean;
        detail: string;
        url: string;
        positions: string[];
    };
}

/**
 * 批量操作对话框组件 - ChatGPT 对话风格
 * 1. 输入框默认居中，发送后移动到底部
 * 2. 用户消息显示在顶部
 * 3. 内置发送按钮，支持回车发送
 * 4. 遵循 Aero-Productivity 设计规范
 */
export function BatchOperationDialog({
    visible,
    onHide,
    templateId,
    mode = 'template',
    targetActionType = 'coach',
    initialTrainingDays = [],
    onApplyLocal,
    existingActions = [],
    onSuccess,
    variant = 'modal',
    onPreviewResult,
    onRestart,
    onGetDaysToApply,
    initialInstruction,
    contextOptions,
}: BatchOperationDialogProps) {
    const isDesktop = useIsDesktop();
    const effectiveVariant = variant === 'auto' ? (isDesktop ? 'panel' : 'modal') : variant;
    const [instruction, setInstruction] = useState('');
    const [submittedInstruction, setSubmittedInstruction] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [isResolvingPendingActions, setIsResolvingPendingActions] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [previewData, setPreviewData] = useState<{
        originalTrainingDays: any;
        updatedTrainingDays: any;
        modifications: ModificationDiff[];
        pendingActions?: PendingActionCandidate[];
    } | null>(null);
    const [queryAnswer, setQueryAnswer] = useState<string | null>(null);
    const [hasStarted, setHasStarted] = useState(false);
    const [pendingActions, setPendingActions] = useState<PendingActionCandidate[]>([]);
    const [pendingResolutions, setPendingResolutions] = useState<Record<string, PendingActionResolution>>({});
    const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
    const [clarificationSuggestions, setClarificationSuggestions] = useState<string[] | null>(null);
    const [contextPanelOpen, setContextPanelOpen] = useState(false);
    const [contextStatusText, setContextStatusText] = useState<string | null>(null);
    const [aiInputSnapshot, setAiInputSnapshot] = useState<AIInputSnapshot | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<any>(null);

    const initialContextState: ContextToggleState = {
        includePlanBody: contextOptions?.includePlanBody ?? true,
        includeActionLibrary: contextOptions?.includeActionLibrary ?? true,
        includeStudentProfile: contextOptions?.includeStudentProfile ?? false,
        includeStudentQuestionnaire: contextOptions?.includeStudentQuestionnaire ?? false,
        includeExecutionHistory: contextOptions?.includeExecutionHistory ?? false,
        includeStudentActionLib: contextOptions?.includeStudentActionLib ?? false,
        includeCoachActionLib: contextOptions?.includeCoachActionLib ?? (targetActionType === 'coach'),
        includePublicActionLib: contextOptions?.includePublicActionLib ?? true,
        includeCoachTemplates: contextOptions?.includeCoachTemplates ?? (targetActionType === 'coach'),
        includeTemplateMatch: contextOptions?.includeTemplateMatch ?? false,
        includeFeedbacks: contextOptions?.includeFeedbacks ?? false,
    };
    const [contextToggles, setContextToggles] = useState<ContextToggleState>(initialContextState);

    // Markdown 渲染器
    const md = useMemo(() => new MarkdownIt({ html: true, linkify: true, typographer: true }), []);

    // 检查是否为开发模式
    const isDevelopment = process.env.NODE_ENV === 'development';

    const itemTypeOptions = [
        { label: '力量', value: 'STRENGTH' },
        { label: '有氧', value: 'CARDIO' },
        { label: '饮食', value: 'DIET' },
        { label: '习惯', value: 'HABIT' },
    ];

    const attrProfilesByType: Record<ItemType, Array<{ label: string; value: string; attrs: string[] }>> = {
        STRENGTH: [
            { label: '次数型（组数+次数+强度+休息）', value: 'STRENGTH_REP', attrs: ['组数', '次数', '强度', '休息时间'] },
            { label: '时长型（组数+时长+强度+休息）', value: 'STRENGTH_TIME', attrs: ['组数', '持续时间', '强度', '休息时间'] },
            { label: '恢复型-次数（组数+次数+休息）', value: 'STRENGTH_MOBILITY_REP', attrs: ['组数', '次数', '休息时间'] },
            { label: '恢复型-时长（组数+时长+休息）', value: 'STRENGTH_MOBILITY_TIME', attrs: ['组数', '持续时间', '休息时间'] },
        ],
        CARDIO: [
            { label: '距离型（距离+配速+时长）', value: 'CARDIO_DISTANCE', attrs: ['距离', '配速', '持续时间'] },
            { label: '间歇型（冲刺+间歇+循环+强度）', value: 'CARDIO_INTERVAL', attrs: ['冲刺时长', '间歇时长', '循环次数', '强度'] },
        ],
        DIET: [
            { label: '复合摄入（食物+热量+宏量营养）', value: 'DIET_MEAL', attrs: ['食物清单', '热量', '宏量营养'] },
            { label: '单一计量（摄入量+时间点）', value: 'DIET_SINGLE', attrs: ['摄入量', '时间点'] },
        ],
        HABIT: [
            { label: '统计型（目标数值+完成状态）', value: 'HABIT_COUNT', attrs: ['目标数值', '完成状态'] },
            { label: '行为型（完成状态）', value: 'HABIT_CHECK', attrs: ['完成状态'] },
        ],
    };

    const contextItems: Array<{ key: keyof ContextToggleState; label: string }> = [
        { key: 'includePlanBody', label: '计划/模板本体' },
        { key: 'includeActionLibrary', label: '动作库与类型说明' },
        { key: 'includeStudentProfile', label: '学员基本情况' },
        { key: 'includeStudentQuestionnaire', label: '学员问卷' },
        { key: 'includeExecutionHistory', label: '执行记录' },
        { key: 'includeStudentActionLib', label: '学员动作库' },
        { key: 'includeCoachActionLib', label: '教练动作库' },
        { key: 'includePublicActionLib', label: '公共动作库' },
        { key: 'includeCoachTemplates', label: '教练模板' },
        { key: 'includeTemplateMatch', label: '模板匹配建议' },
        { key: 'includeFeedbacks', label: '学员反馈' },
    ];

    const visibleContextItems = useMemo(() => {
        if (targetActionType === 'student') {
            const hiddenForStudent = new Set<keyof ContextToggleState>([
                'includeCoachActionLib',
                'includeCoachTemplates',
                'includeTemplateMatch',
                'includeFeedbacks',
            ]);
            return contextItems.filter((item) => !hiddenForStudent.has(item.key));
        }
        return contextItems;
    }, [contextItems, targetActionType]);

    const buildRuntimeContextOptions = (): BatchOperationContextOptions => {
        const next: BatchOperationContextOptions = {
            subscriptionId: contextOptions?.subscriptionId,
            subjectUserId: contextOptions?.subjectUserId,
            ...contextToggles,
        };
        if (targetActionType === 'student') {
            next.includeCoachActionLib = false;
            next.includeCoachTemplates = false;
            next.includeTemplateMatch = false;
            next.includeFeedbacks = false;
        }
        return next;
    };

    const buildDefaultResolution = (pending: PendingActionCandidate): PendingActionResolution => ({
        mode: 'create_new',
        existingActionId: null,
        createPayload: {
            name: pending.suggestedName || '',
            type: pending.suggestedType || 'STRENGTH',
            attrs: pending.suggestedAttrs?.length
                ? pending.suggestedAttrs
                : (attrProfilesByType[(pending.suggestedType || 'STRENGTH') as ItemType]?.[0]?.attrs || []),
            needsAutoCompute: false,
            includesBodyWeight: false,
            detail: '',
            url: '',
            positions: ['全身'],
        },
    });

    const remapActionIdsInDays = (days: any[], actionIdMapping: Record<string, string>): any[] => {
        const mapSet = new Set(Object.keys(actionIdMapping || {}));
        if (mapSet.size === 0) return days;
        return (days || []).map((day) => ({
            ...day,
            actionSets: (day.actionSets || []).map((set: any) => {
                const nextSet = { ...set };
                if (nextSet.actionId && mapSet.has(nextSet.actionId)) {
                    nextSet.actionId = actionIdMapping[nextSet.actionId];
                }
                if (nextSet.type === 'one-filter' && Array.isArray(nextSet.actions)) {
                    nextSet.actions = nextSet.actions.map((inner: any) => {
                        if (!inner?.actionId || !mapSet.has(inner.actionId)) return inner;
                        return {
                            ...inner,
                            actionId: actionIdMapping[inner.actionId],
                        };
                    });
                }
                return nextSet;
            }),
        }));
    };

    const existingActionOptions = useMemo(
        () => existingActions.map((action) => ({ label: action.name, value: action.id })),
        [existingActions],
    );

    const getProfileValueForAttrs = (type: ItemType, attrs: string[]) => {
        const list = attrProfilesByType[type] || [];
        const found = list.find(
            (p) => p.attrs.length === attrs.length && p.attrs.every((v, idx) => v === attrs[idx]),
        );
        return found?.value || null;
    };

    const hasUnresolvedPendingActions = useMemo(() => {
        return pendingActions.some((pending) => {
            const resolution = pendingResolutions[pending.tempActionId];
            if (!resolution) return true;
            if (resolution.mode === 'use_existing') {
                return !resolution.existingActionId;
            }
            return !resolution.createPayload.name.trim() || !resolution.createPayload.attrs?.length;
        });
    }, [pendingActions, pendingResolutions]);
    const hasPendingActions = pendingActions.length > 0;

    // 自动滚动到日志底部（使用 auto 避免 smooth 滚动视窗，仅滚动对话框内容器）
    // 当 visible 变为 true 且有预填指令时自动填入
    useEffect(() => {
        if (visible && initialInstruction) {
            setInstruction(initialInstruction);
        }
    }, [visible, initialInstruction]);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (el) {
            el.scrollTop = el.scrollHeight;
        }
    }, [logs, queryAnswer, isProcessing, pendingActions]);

    // 添加日志条目
    const addLog = (type: LogEntry['type'], content: string, data?: any) => {
        setLogs(prev => [...prev, { type, content, timestamp: new Date(), data }]);
    };

    // 处理 SSE 消息
    const handleMessage = (message: SSEMessage) => {
        switch (message.type) {
            case 'progress':
                // 不展示「加载训练计划」「加载动作库」等前置步骤，保持界面简洁
                if (
                    message.message !== '正在加载训练计划' &&
                    message.message !== '正在加载动作库' &&
                    message.message !== '正在构建上下文信息'
                ) {
                    addLog('progress', message.message);
                }
                break;
            
            case 'action_plan':
                addLog('action_plan', `📋 ${message.plan}`);
                break;

            case 'context_applied':
                setContextStatusText(message.message);
                addLog(
                    'progress',
                    `已使用上下文：${(message.enabled || []).join('、') || '无'}${
                        message.unavailable?.length ? `；不可用：${message.unavailable.join('、')}` : ''
                    }`,
                );
                break;

            case 'ai_input_snapshot':
                setAiInputSnapshot({
                    fixedInjected: message.fixedInjected || [],
                    baselineEnabledContext: message.baselineEnabledContext || [],
                    currentEnabledContext: message.currentEnabledContext || [],
                    addedByContextToggle: message.addedByContextToggle || [],
                    baselineContextPrompt: message.baselineContextPrompt || '',
                    currentContextPrompt: message.currentContextPrompt || '',
                    fullPrompts: message.fullPrompts,
                });
                break;

            case 'need_clarification':
                addLog('need_clarification', message.question);
                setConversationHistory((prev) => [...prev, { role: 'assistant', content: message.question }]);
                setClarificationSuggestions(message.suggestions?.length ? message.suggestions : null);
                break;

            case 'new_actions_detected':
                addLog('new_actions', message.message);
                break;
            
            case 'stats':
                if (isDevelopment && message.tokenUsage) {
                    const statsText = `📊 Token: ${message.tokenUsage.total} (提示:${message.tokenUsage.prompt} + 生成:${message.tokenUsage.completion}) | 耗时: ${message.duration}ms`;
                    addLog('stats', statsText, message);
                }
                break;
            
            case 'preview_result':
                if (message.success) {
                    addLog('success', `✅ ${message.message}`);
                    const nextPending = message.pendingActions || [];
                    setPreviewData({
                        originalTrainingDays: message.originalTrainingDays,
                        updatedTrainingDays: message.updatedTrainingDays,
                        modifications: message.modifications,
                        pendingActions: nextPending,
                    });
                    setPendingActions(nextPending);
                    const resolutionMap: Record<string, PendingActionResolution> = {};
                    for (const pending of nextPending) {
                        resolutionMap[pending.tempActionId] = buildDefaultResolution(pending);
                    }
                    setPendingResolutions(resolutionMap);
                    onPreviewResult?.({
                        originalTrainingDays: message.originalTrainingDays,
                        updatedTrainingDays: message.updatedTrainingDays,
                        modifications: message.modifications
                    });
                } else {
                    addLog('error', '操作失败');
                }
                break;
            
            case 'query_result':
                addLog('success', '✅ 分析完成');
                addLog('ai_response', message.answer || '');
                setQueryAnswer(message.answer);
                break;
            
            case 'error':
                addLog('error', `❌ ${message.message}`);
                break;
        }
    };

    const runFirstRound = async (previewInputOnly: boolean) => {
        const firstInstruction = instruction.trim() || '（仅预览输入）';
        if (!firstInstruction && !previewInputOnly) return;
        setHasStarted(true);
        setSubmittedInstruction(firstInstruction);
        setIsProcessing(true);
        setLogs([]);
        setPreviewData(null);
        setQueryAnswer(null);
        setPendingActions([]);
        setPendingResolutions({});
        setConversationHistory([]);
        setClarificationSuggestions(null);
        setAiInputSnapshot(null);

        const runtimeContextOptions = buildRuntimeContextOptions();

        if (mode === 'local') {
            await BatchOperationService.executeBatchOperationLocal(
                initialTrainingDays,
                firstInstruction,
                handleMessage,
                () => setIsProcessing(false),
                (error) => {
                    addLog('error', error);
                    setIsProcessing(false);
                },
                [],
                targetActionType,
                runtimeContextOptions,
                previewInputOnly
            );
            return;
        }

        if (!templateId) {
            addLog('error', '缺少 templateId，无法执行 AI 修改');
            setIsProcessing(false);
            return;
        }

        await BatchOperationService.executeBatchOperation(
            templateId,
            firstInstruction,
            handleMessage,
            () => setIsProcessing(false),
            (error) => {
                addLog('error', error);
                setIsProcessing(false);
            },
            [],
            targetActionType,
            runtimeContextOptions,
            previewInputOnly
        );
    };

    // 执行批量操作（含 AI 分析/修改）
    const handleExecute = async () => {
        if (!instruction.trim()) return;
        await runFirstRound(false);
    };

    // 仅预览 AI 输入（不调用模型）
    const handlePreviewInputOnly = async () => {
        await runFirstRound(true);
    };

    // 多轮对话：用户收到 need_clarification 后在底部输入框补充信息并发送
    const handleSendFollowUp = async () => {
        const trimmed = instruction.trim();
        if (!trimmed || isProcessing) return;

        const nextHistory: ConversationTurn[] = [
            ...conversationHistory,
            { role: 'user', content: trimmed },
        ];
        setConversationHistory(nextHistory);
        setClarificationSuggestions(null);
        addLog('user_message', trimmed);
        setInstruction('');
        setIsProcessing(true);

        const runtimeContextOptions = buildRuntimeContextOptions();

        if (mode === 'local') {
            await BatchOperationService.executeBatchOperationLocal(
                initialTrainingDays,
                submittedInstruction,
                handleMessage,
                () => setIsProcessing(false),
                (error) => {
                    addLog('error', error);
                    setIsProcessing(false);
                },
                nextHistory,
                targetActionType,
                runtimeContextOptions
            );
            return;
        }

        if (!templateId) {
            addLog('error', '缺少 templateId，无法执行 AI 修改');
            setIsProcessing(false);
            return;
        }

        await BatchOperationService.executeBatchOperation(
            templateId,
            submittedInstruction,
            handleMessage,
            () => setIsProcessing(false),
            (error) => {
                addLog('error', error);
                setIsProcessing(false);
            },
            nextHistory,
            targetActionType,
            runtimeContextOptions
        );
    };

    // 处理键盘事件（未开始时为首次发送，已开始时为补充发送）
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (isProcessing) return;
            if (!hasStarted && instruction.trim()) handleExecute();
            else if (hasStarted && instruction.trim()) handleSendFollowUp();
        }
    };

    // 底部输入框回车发送（仅已开始状态）
    const handleBottomKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isProcessing && instruction.trim()) handleSendFollowUp();
        }
    };

    const handleResolvePendingActions = async () => {
        if (!previewData || pendingActions.length === 0) return;

        setIsResolvingPendingActions(true);
        try {
            const payloadActions = pendingActions.map((pending) => {
                const resolution = pendingResolutions[pending.tempActionId];
                if (!resolution) {
                    throw new Error(`缺少动作确认项：${pending.suggestedName}`);
                }
                if (resolution.mode === 'use_existing') {
                    if (!resolution.existingActionId) {
                        throw new Error(`请为「${pending.suggestedName}」选择已有动作`);
                    }
                    return {
                        tempActionId: pending.tempActionId,
                        decision: 'use_existing',
                        existingActionId: resolution.existingActionId,
                    };
                }
                if (!resolution.createPayload.name.trim()) {
                    throw new Error(`请填写新动作名称：${pending.suggestedName}`);
                }
                return {
                    tempActionId: pending.tempActionId,
                    decision: 'create_new',
                    createPayload: {
                        ...resolution.createPayload,
                        name: resolution.createPayload.name.trim(),
                    },
                };
            });

            addLog('progress', `正在确认 ${pendingActions.length} 个缺失动作`);
            const confirmRes = await fetch('/api/plan-lib/confirm-batch-actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actions: payloadActions, targetActionType }),
            });
            const confirmResult = await confirmRes.json();
            if (!confirmRes.ok || !confirmResult.success) {
                throw new Error(confirmResult.message || '动作确认失败');
            }

            const mapping = confirmResult.data?.actionIdMapping || {};
            const sourceDays = onGetDaysToApply?.() ?? previewData.updatedTrainingDays;
            const mappedDays = remapActionIdsInDays(sourceDays, mapping);
            const nextPreview = {
                ...previewData,
                updatedTrainingDays: mappedDays,
                pendingActions: [],
            };
            setPreviewData(nextPreview);
            setPendingActions([]);
            setPendingResolutions({});
            onPreviewResult?.({
                originalTrainingDays: nextPreview.originalTrainingDays,
                updatedTrainingDays: mappedDays,
                modifications: nextPreview.modifications,
            });

            const createdCount = (confirmResult.data?.createdActions || []).length;
            addLog('success', createdCount > 0
                ? `✅ 已创建 ${createdCount} 个新动作，并已映射到计划`
                : '✅ 缺失动作已映射到计划');
        } catch (error: any) {
            addLog('error', `动作确认失败: ${error.message}`);
        } finally {
            setIsResolvingPendingActions(false);
        }
    };

    // 应用修改到数据库
    const handleApply = async () => {
        if (!previewData) return;
        if (hasPendingActions) {
            addLog('error', '请先执行“确认并映射动作”，再应用计划');
            return;
        }

        if (mode === 'local') {
            const daysToApply = onGetDaysToApply?.() ?? previewData.updatedTrainingDays;
            onApplyLocal?.(daysToApply);
            addLog('success', '🎉 修改已应用到当前草稿！');
            if (onSuccess) {
                setTimeout(() => {
                    onSuccess();
                    handleHide();
                }, 600);
            }
            return;
        }

        if (!templateId) {
            addLog('error', '缺少 templateId，无法应用修改');
            return;
        }

        setIsApplying(true);
        try {
            const daysToApply = onGetDaysToApply?.() ?? previewData.updatedTrainingDays;
            const response = await fetch('/api/plan-lib/apply-batch-operation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    templateId,
                    updatedTrainingDays: daysToApply,
                    targetActionType,
                }),
            });

            const result = await response.json();

            if (result.success) {
                addLog('success', '🎉 修改已成功应用！');
                if (onSuccess) {
                    setTimeout(() => {
                        onSuccess();
                        handleHide();
                    }, 1000);
                }
            } else {
                addLog('error', `应用失败: ${result.message}`);
            }
        } catch (error: any) {
            addLog('error', `应用失败: ${error.message}`);
        } finally {
            setIsApplying(false);
        }
    };

    // 重置对话框状态
    const handleHide = () => {
        if (!isProcessing && !isApplying && !isResolvingPendingActions) {
            setInstruction('');
            setSubmittedInstruction('');
            setLogs([]);
            setPreviewData(null);
            setQueryAnswer(null);
            setHasStarted(false);
            setPendingActions([]);
            setPendingResolutions({});
            setConversationHistory([]);
            setClarificationSuggestions(null);
            setContextStatusText(null);
            setAiInputSnapshot(null);
            onHide();
        }
    };

    // 重新开始
    const handleRestart = () => {
        onRestart?.();
        setInstruction('');
        setSubmittedInstruction('');
        setLogs([]);
        setPreviewData(null);
        setQueryAnswer(null);
        setHasStarted(false);
        setPendingActions([]);
        setPendingResolutions({});
        setConversationHistory([]);
        setClarificationSuggestions(null);
        setContextStatusText(null);
        setAiInputSnapshot(null);
    };

    const renderLogEntry = (entry: LogEntry, index: number) => {
        if (entry.type === 'user_message') {
            return (
                <div key={index} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center shrink-0 font-bold text-sm">你</div>
                    <div className="flex-1 bg-surface-50 rounded-2xl p-4 border border-surface-100">
                        <div className="text-surface-900 text-sm leading-relaxed">{entry.content}</div>
                    </div>
                </div>
            );
        }

        if (entry.type === 'ai_response') {
            return (
                <div key={index} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                        <i className="pi pi-sparkles text-sm" />
                    </div>
                    <div className="flex-1 min-w-0 bg-surface-50 dark:bg-surface-800 rounded-2xl p-4 border border-surface-100 dark:border-surface-700">
                        <div className="prose prose-sm max-w-none text-surface-700 dark:text-surface-300 markdown-message-content">
                            <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: DOMPurify?.sanitize(md.render(entry.content || '')) }} />
                        </div>
                    </div>
                </div>
            );
        }

        if (entry.type === 'need_clarification') {
            return (
                <div key={index} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                        <i className="pi pi-question-circle text-sm" />
                    </div>
                    <div className="flex-1 min-w-0 bg-amber-50 rounded-2xl p-4 border border-amber-200">
                        <div className="text-sm leading-relaxed text-amber-900">{entry.content}</div>
                    </div>
                </div>
            );
        }

        const timeStr = entry.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const isLastEntry = index === logs.length - 1;
        const isError = entry.type === 'error';
        const isNewActions = entry.type === 'new_actions';

        const getLogIcon = () => {
            switch (entry.type) {
                case 'progress': return isLastEntry && isProcessing ? 'pi-spin pi-spinner' : 'pi-check';
                case 'action_plan': return 'pi-list';
                case 'stats': return 'pi-chart-bar';
                case 'success': return 'pi-check-circle';
                case 'error': return 'pi-exclamation-circle';
                case 'new_actions': return 'pi-plus-circle';
                default: return 'pi-info-circle';
            }
        };

        return (
            <div
                key={index}
                className={`
                    ${isError
                        ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/30'
                        : isNewActions
                        ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/30'
                        : 'bg-surface-50 border-surface-200'}
                    border rounded-xl px-3 py-2 flex items-center gap-2.5 log-entry-animation
                `}
                style={{ animationDelay: `${index * 50}ms` }}
            >
                <div className={`shrink-0 ${isError ? 'text-red-500' : isNewActions ? 'text-amber-600' : 'text-surface-400'}`}>
                    <i className={`pi ${getLogIcon()} text-xs`} />
                </div>
                <div className={`flex-1 min-w-0 text-xs font-medium leading-relaxed ${
                    isError ? 'text-red-700 dark:text-red-300' : isNewActions ? 'text-amber-800' : 'text-surface-700 dark:text-surface-500'
                }`}>{entry.content}</div>
                {entry.type !== 'stats' && (
                    <div className={`shrink-0 text-[10px] font-medium tabular-nums ${
                        isError ? 'text-red-400' : isNewActions ? 'text-amber-600' : 'text-surface-400'
                    }`}>{timeStr}</div>
                )}
            </div>
        );
    };

    const content = (
        <div className="flex flex-col h-full min-h-0">
                {/* 未开始状态：居中显示输入框 */}
                {!hasStarted && (
                    <div className="flex-1 flex flex-col items-center justify-center px-8 relative">
                        {/* 右上角关闭按钮 */}
                        <Button
                            icon="pi pi-times"
                            text
                            severity="secondary"
                            className="absolute top-6 right-8 w-10 h-10 rounded-xl text-surface-600 hover:text-surface-900 hover:bg-surface-50 active:scale-[0.95] transition-all"
                            onClick={handleHide}
                            aria-label="关闭"
                            tooltipOptions={{ position: 'left' }}
                        />
                        
                        <div className="w-full max-w-3xl space-y-6">
                            {/* 标题区域 - 仅在未开始时显示 */}
                            <div className="text-center space-y-3">
                                <div className="text-3xl font-black tracking-tight text-surface-900">
                                    教链 AI 计划修改器
                                </div>
                                <div className="text-sm text-surface-500 font-medium">
                                    使用自然语言描述批量操作，系统会自动识别并预览修改内容
                                </div>
                                <div className="flex items-center justify-center gap-2">
                                    <span className="text-xs text-surface-500">
                                        上下文已开启 {Object.values(contextToggles).filter(Boolean).length} 项
                                    </span>
                                    <Button
                                        label={contextPanelOpen ? '收起上下文设置' : '上下文设置'}
                                        icon="pi pi-sliders-h"
                                        text
                                        size="small"
                                        className="rounded-xl"
                                        onClick={() => setContextPanelOpen((v) => !v)}
                                    />
                                </div>
                            </div>

                            {contextPanelOpen && (
                                <div className="rounded-2xl border border-surface-200 bg-surface-50/70 p-3">
                                    <div className="text-xs text-surface-500 mb-2">选择 AI 本次可读取的上下文</div>
                                    <div className="flex flex-wrap gap-2">
                                        {visibleContextItems.map((item) => {
                                            const active = contextToggles[item.key];
                                            return (
                                                <button
                                                    key={item.key}
                                                    type="button"
                                                    onClick={() =>
                                                        setContextToggles((prev) => ({
                                                            ...prev,
                                                            [item.key]: !prev[item.key],
                                                        }))
                                                    }
                                                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                                                        active
                                                            ? 'border-primary-300 bg-primary-50 text-primary-700'
                                                            : 'border-surface-200 bg-surface text-surface-500'
                                                    }`}
                                                >
                                                    {active ? '✓ ' : ''}{item.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* 示例问题 */}
                            <div className="flex flex-wrap justify-center gap-2">
                                {[
                                    {
                                        label: '计划分析',
                                        text: "帮我分析一下目前的计划中，有氧运动和力量训练的比例是多少？每周的训练量分布是否合理？",
                                        icon: 'pi-chart-bar'
                                    },
                                    {
                                        label: '器械替换',
                                        text: "学员现在可以去健身房了，把所有的 '弹力带下拉' 替换为 '固定器械高位下拉'，要求是 15RM 的重量做 4 组。",
                                        icon: 'pi-sync'
                                    },
                                    {
                                        label: '强度调整',
                                        text: "我觉得前 4 周的强度定高了，把 W1 到 W4 所有的 RPE 9 全都改为 RPE 8，间歇保持不变。",
                                        icon: 'pi-sliders-h'
                                    },
                                    {
                                        label: '周期性添加',
                                        text: "为了增强核心稳定性，在每周的第一天（D1）结束时，增加一个 '平板支撑 3 组，每组 1 分钟' 的收尾动作。",
                                        icon: 'pi-plus-circle'
                                    },
                                ].map((example, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-surface-600 bg-surface-100 hover:bg-surface-200 hover:text-surface-900 active:scale-[0.97] transition-all cursor-pointer border-none"
                                        onClick={() => setInstruction(example.text)}
                                    >
                                        <i className={`pi ${example.icon} text-[10px]`}></i>
                                        {example.label}
                                    </button>
                                ))}
                            </div>

                            {/* 输入框容器 */}
                            <div className="relative">
                                <InputTextarea
                                    ref={textareaRef}
                                    value={instruction}
                                    onChange={(e) => setInstruction(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    rows={4}
                                    className="w-full rounded-2xl border-surface-200 focus:border-primary-300 text-base pr-12 resize-none"
                                    placeholder="描述你想要进行的批量操作，例如：把所有深蹲改为5组8次，重量100kg"
                                    autoFocus
                                />
                                {/* 发送按钮 */}
                                <Button
                                    icon={isProcessing ? 'pi pi-spin pi-spinner' : 'pi pi-send'}
                                    className="absolute bottom-3 right-3 w-10 h-10 rounded-xl bg-surface-900 border-none text-surface-0 hover:bg-surface-800 active:scale-[0.95] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                    onClick={handleExecute}
                                    disabled={!instruction.trim() || isProcessing}
                                    aria-label="发送"
                                />
                            </div>
                            
                            {/* 提示文字 */}
                            <div className="flex items-center justify-center gap-3 text-xs">
                                <span className="text-surface-400">按 Enter 发送，Shift + Enter 换行</span>
                                <Button
                                    label="仅预览 AI 输入"
                                    icon="pi pi-eye"
                                    text
                                    size="small"
                                    className="rounded-xl"
                                    onClick={handlePreviewInputOnly}
                                    disabled={isProcessing}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* 已开始状态：聊天式对话界面 */}
                {hasStarted && (
                    <div className="flex flex-col h-full min-h-0">
                        {/* 顶栏：返回 + 上下文 + 预览 */}
                        <div className="flex-shrink-0 px-5 pt-4 pb-2 flex items-center border-b border-surface-100/60">
                            <Button
                                icon="pi pi-arrow-left"
                                text
                                severity="secondary"
                                className="rounded-xl text-surface-600 hover:text-surface-900 hover:bg-surface-50 active:scale-[0.98] transition-all -ml-2"
                                onClick={handleHide}
                                disabled={isProcessing || isApplying || isResolvingPendingActions}
                                aria-label="关闭"
                            />
                            <div className="ml-2 flex items-center gap-2">
                                <Button
                                    icon="pi pi-sliders-h"
                                    text
                                    severity="secondary"
                                    className="rounded-xl"
                                    onClick={() => setContextPanelOpen((v) => !v)}
                                    disabled={isProcessing || isApplying || isResolvingPendingActions}
                                    aria-label="上下文设置"
                                />
                                <span className="text-xs text-surface-500">
                                    上下文 {Object.values(contextToggles).filter(Boolean).length} 项
                                </span>
                                <Button
                                    label="仅预览输入"
                                    icon="pi pi-eye"
                                    text
                                    size="small"
                                    className="rounded-xl"
                                    onClick={handlePreviewInputOnly}
                                    disabled={isProcessing || isApplying || isResolvingPendingActions}
                                />
                            </div>
                        </div>

                        {/* 上下文设置面板（折叠，不占滚动区） */}
                        {contextPanelOpen && (
                            <div className="flex-shrink-0 px-5 py-3 border-b border-surface-100/60">
                                <div className="rounded-2xl border border-surface-200 bg-surface-50/70 p-3">
                                    <div className="text-xs text-surface-500 mb-2">当前会话上下文开关</div>
                                    <div className="flex flex-wrap gap-2">
                                        {visibleContextItems.map((item) => {
                                            const active = contextToggles[item.key];
                                            return (
                                                <button
                                                    key={item.key}
                                                    type="button"
                                                    onClick={() =>
                                                        setContextToggles((prev) => ({
                                                            ...prev,
                                                            [item.key]: !prev[item.key],
                                                        }))
                                                    }
                                                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                                                        active
                                                            ? 'border-primary-300 bg-primary-50 text-primary-700'
                                                            : 'border-surface-200 bg-surface text-surface-500'
                                                    }`}
                                                >
                                                    {active ? '✓ ' : ''}{item.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* === 聊天滚动区域 === */}
                        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar">
                            {/* 用户首条消息 */}
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center shrink-0 font-bold text-sm">你</div>
                                <div className="flex-1 bg-surface-50 rounded-2xl p-4 border border-surface-100">
                                    <div className="text-surface-900 text-sm leading-relaxed">{submittedInstruction}</div>
                                </div>
                            </div>

                            {contextStatusText && (
                                <div className="rounded-xl border border-primary-200 bg-primary-50/70 px-3 py-2 text-xs text-primary-700">
                                    {contextStatusText}
                                </div>
                            )}
                            {aiInputSnapshot && (
                                <details className="rounded-xl border border-surface-200 bg-surface-50/60 px-3 py-2">
                                    <summary className="cursor-pointer text-xs font-medium text-surface-700">AI 输入快照（仅结果）</summary>
                                    <div className="mt-2 space-y-2 text-xs">
                                        {aiInputSnapshot.fullPrompts ? (
                                            <>
                                                <details className="rounded-lg bg-surface p-2 border border-surface-200">
                                                    <summary className="cursor-pointer font-medium text-surface-700">意图判断 Prompt</summary>
                                                    <pre className="mt-2 max-h-64 overflow-auto custom-scrollbar rounded-md bg-surface-50 p-2 text-[11px] leading-5 whitespace-pre-wrap text-surface-600">{aiInputSnapshot.fullPrompts.intentPrompt}</pre>
                                                </details>
                                                <details className="rounded-lg bg-surface p-2 border border-surface-200">
                                                    <summary className="cursor-pointer font-medium text-surface-700">查询分析 Prompt</summary>
                                                    <pre className="mt-2 max-h-64 overflow-auto custom-scrollbar rounded-md bg-surface-50 p-2 text-[11px] leading-5 whitespace-pre-wrap text-surface-600">{aiInputSnapshot.fullPrompts.queryPrompt}</pre>
                                                </details>
                                                <details className="rounded-lg bg-surface p-2 border border-surface-200">
                                                    <summary className="cursor-pointer font-medium text-surface-700">补充追问 Prompt</summary>
                                                    <pre className="mt-2 max-h-64 overflow-auto custom-scrollbar rounded-md bg-surface-50 p-2 text-[11px] leading-5 whitespace-pre-wrap text-surface-600">{aiInputSnapshot.fullPrompts.clarificationPrompt}</pre>
                                                </details>
                                                <details className="rounded-lg bg-surface p-2 border border-surface-200">
                                                    <summary className="cursor-pointer font-medium text-surface-700">代码生成 Prompt</summary>
                                                    <pre className="mt-2 max-h-64 overflow-auto custom-scrollbar rounded-md bg-surface-50 p-2 text-[11px] leading-5 whitespace-pre-wrap text-surface-600">{aiInputSnapshot.fullPrompts.systemPrompt}</pre>
                                                </details>
                                            </>
                                        ) : (
                                            <>
                                                <div className="rounded-lg bg-surface p-2 border border-surface-200">
                                                    <div className="font-semibold text-surface-700 mb-1">当前开关实际增强上下文</div>
                                                    <div className="text-surface-600">
                                                        {(aiInputSnapshot.currentEnabledContext || []).join('、') || '无'}
                                                    </div>
                                                </div>
                                                <details className="rounded-lg bg-surface p-2 border border-surface-200">
                                                    <summary className="cursor-pointer font-medium text-surface-700">查看：当前开关上下文文本</summary>
                                                    <pre className="mt-2 max-h-64 overflow-auto custom-scrollbar rounded-md bg-surface-50 p-2 text-[11px] leading-5 whitespace-pre-wrap text-surface-600">
                                                        {aiInputSnapshot.currentContextPrompt}
                                                    </pre>
                                                </details>
                                            </>
                                        )}
                                    </div>
                                </details>
                            )}

                            {/* 日志 + 聊天气泡时间线 */}
                            {logs.length > 0 && (
                                <div className="space-y-3">
                                    {logs.map((entry, index) => renderLogEntry(entry, index))}
                                </div>
                            )}

                                {pendingActions.length > 0 && (
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 space-y-3">
                                        <div className="text-sm font-bold text-amber-800">
                                            需先确认缺失动作（{pendingActions.length} 项）
                                        </div>
                                        <div className="text-xs text-amber-700">
                                            应用前必须先由你确认：使用已有动作或新建动作（含类型和属性模板）。
                                        </div>
                                        <div className="space-y-3">
                                            {pendingActions.map((pending) => {
                                                const resolution = pendingResolutions[pending.tempActionId] || buildDefaultResolution(pending);
                                                return (
                                                    <div key={pending.tempActionId} className="rounded-xl border border-amber-200 bg-surface-0 p-3 space-y-2">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-sm font-bold text-surface-900">{pending.suggestedName}</span>
                                                            <span className="text-[11px] text-surface-500">出现 {pending.occurrences} 次</span>
                                                            <span className="text-[11px] text-surface-500">训练日：{pending.sourceDayIndexes.join('、')}</span>
                                                        </div>

                                                        <div className="flex gap-2">
                                                            <Button
                                                                label={resolution.mode === 'use_existing' ? '使用已有（已选）' : '使用已有'}
                                                                size="small"
                                                                text={resolution.mode !== 'use_existing'}
                                                                severity={resolution.mode === 'use_existing' ? 'success' : 'secondary'}
                                                                onClick={() => {
                                                                    setPendingResolutions((prev) => ({
                                                                        ...prev,
                                                                        [pending.tempActionId]: {
                                                                            ...resolution,
                                                                            mode: 'use_existing',
                                                                        },
                                                                    }));
                                                                }}
                                                            />
                                                            <Button
                                                                label={resolution.mode === 'create_new' ? '新建动作（已选）' : '新建动作'}
                                                                size="small"
                                                                text={resolution.mode !== 'create_new'}
                                                                severity={resolution.mode === 'create_new' ? 'success' : 'secondary'}
                                                                onClick={() => {
                                                                    setPendingResolutions((prev) => ({
                                                                        ...prev,
                                                                        [pending.tempActionId]: {
                                                                            ...resolution,
                                                                            mode: 'create_new',
                                                                        },
                                                                    }));
                                                                }}
                                                            />
                                                        </div>

                                                        {resolution.mode === 'use_existing' ? (
                                                            <Dropdown
                                                                value={resolution.existingActionId}
                                                                options={existingActionOptions}
                                                                onChange={(e) => {
                                                                    setPendingResolutions((prev) => ({
                                                                        ...prev,
                                                                        [pending.tempActionId]: {
                                                                            ...resolution,
                                                                            existingActionId: e.value || null,
                                                                        },
                                                                    }));
                                                                }}
                                                                placeholder="选择已有动作"
                                                                filter
                                                                className="w-full"
                                                            />
                                                        ) : (
                                                            <div className="space-y-2">
                                                                <InputText
                                                                    value={resolution.createPayload.name}
                                                                    onChange={(e) => {
                                                                        setPendingResolutions((prev) => ({
                                                                            ...prev,
                                                                            [pending.tempActionId]: {
                                                                                ...resolution,
                                                                                createPayload: {
                                                                                    ...resolution.createPayload,
                                                                                    name: e.target.value,
                                                                                },
                                                                            },
                                                                        }));
                                                                    }}
                                                                    placeholder="新动作名称"
                                                                    className="w-full"
                                                                />
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                    <Dropdown
                                                                        value={resolution.createPayload.type}
                                                                        options={itemTypeOptions}
                                                                        onChange={(e) => {
                                                                            const nextType = e.value as ItemType;
                                                                            const defaultAttrs = attrProfilesByType[nextType]?.[0]?.attrs || [];
                                                                            setPendingResolutions((prev) => ({
                                                                                ...prev,
                                                                                [pending.tempActionId]: {
                                                                                    ...resolution,
                                                                                    createPayload: {
                                                                                        ...resolution.createPayload,
                                                                                        type: nextType,
                                                                                        attrs: defaultAttrs,
                                                                                        needsAutoCompute: nextType === 'STRENGTH'
                                                                                            ? resolution.createPayload.needsAutoCompute
                                                                                            : false,
                                                                                        includesBodyWeight: nextType === 'STRENGTH'
                                                                                            ? resolution.createPayload.includesBodyWeight
                                                                                            : false,
                                                                                    },
                                                                                },
                                                                            }));
                                                                        }}
                                                                        className="w-full"
                                                                    />
                                                                    <Dropdown
                                                                        value={getProfileValueForAttrs(
                                                                            resolution.createPayload.type,
                                                                            resolution.createPayload.attrs,
                                                                        )}
                                                                        options={attrProfilesByType[resolution.createPayload.type]}
                                                                        onChange={(e) => {
                                                                            const profile = (attrProfilesByType[resolution.createPayload.type] || [])
                                                                                .find((p) => p.value === e.value);
                                                                            if (!profile) return;
                                                                            setPendingResolutions((prev) => ({
                                                                                ...prev,
                                                                                [pending.tempActionId]: {
                                                                                    ...resolution,
                                                                                    createPayload: {
                                                                                        ...resolution.createPayload,
                                                                                        attrs: profile.attrs,
                                                                                    },
                                                                                },
                                                                            }));
                                                                        }}
                                                                        placeholder="属性模板"
                                                                        className="w-full"
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                            {/* AI 思考中指示器 */}
                            {isProcessing && (
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center shrink-0">
                                        <i className="pi pi-sparkles text-sm" />
                                    </div>
                                    <div className="bg-surface-50 rounded-2xl px-4 py-3 border border-surface-100">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex gap-1">
                                                <span className="w-1.5 h-1.5 bg-surface-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <span className="w-1.5 h-1.5 bg-surface-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <span className="w-1.5 h-1.5 bg-surface-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                            <span className="text-xs text-surface-500 font-medium">AI 正在思考…</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={logsEndRef} />
                        </div>
                        {/* === 聊天滚动区结束 === */}

                        {/* 操作按钮栏（固定在底部） */}
                        {(previewData || hasPendingActions) && (
                            <div className="flex-shrink-0 px-5 py-2 border-t border-surface-100 flex flex-wrap items-center justify-center gap-2">
                                {hasPendingActions && (
                                    <Button
                                        label={isResolvingPendingActions ? '映射中...' : '1. 确认并映射动作'}
                                        icon={isResolvingPendingActions ? 'pi pi-spin pi-spinner' : 'pi pi-link'}
                                        className="rounded-xl py-1.5 px-4 text-[11px] font-bold bg-surface-900 border-none text-surface-0 hover:bg-surface-800 active:scale-[0.98] transition-all shadow-sm"
                                        onClick={handleResolvePendingActions}
                                        disabled={isResolvingPendingActions || hasUnresolvedPendingActions || isApplying}
                                    />
                                )}
                                <Button
                                    label="重新开始"
                                    icon="pi pi-refresh"
                                    text
                                    severity="secondary"
                                    className="rounded-xl text-[11px] font-bold py-1.5 px-3 text-surface-600 hover:text-surface-900 hover:bg-surface-50 active:scale-[0.98] transition-all"
                                    onClick={handleRestart}
                                    disabled={isProcessing || isApplying || isResolvingPendingActions}
                                />
                                {previewData && (
                                    <Button
                                        label={isApplying ? '应用中...' : (hasPendingActions ? '2. 确认应用' : '确认应用')}
                                        icon={isApplying ? undefined : 'pi pi-check'}
                                        className="rounded-xl py-1.5 px-4 text-[11px] font-bold bg-primary-600 border-none text-white hover:bg-primary-700 active:scale-[0.98] transition-all shadow-sm shadow-primary-200"
                                        onClick={handleApply}
                                        disabled={isApplying || hasPendingActions || isResolvingPendingActions}
                                        loading={isApplying}
                                    />
                                )}
                                {(hasUnresolvedPendingActions || hasPendingActions) && (
                                    <span className="w-full text-center text-[11px] text-amber-600">
                                        {hasUnresolvedPendingActions
                                            ? '请先完成所有缺失动作确认，再执行“确认并映射动作”'
                                            : '请先执行“确认并映射动作”，再确认应用'}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* 底部输入区（固定） */}
                        <div className="flex-shrink-0 border-t border-surface-100 dark:border-surface-700 px-5 pt-3 pb-4">
                            {clarificationSuggestions && clarificationSuggestions.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {clarificationSuggestions.map((s, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-surface-600 bg-surface-100 hover:bg-surface-200 hover:text-surface-900 active:scale-[0.97] transition-all cursor-pointer border border-surface-200 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700"
                                            onClick={() => setInstruction(s)}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="relative">
                                <InputTextarea
                                    value={instruction}
                                    onChange={(e) => setInstruction(e.target.value)}
                                    onKeyDown={handleBottomKeyDown}
                                    placeholder={
                                        conversationHistory.some((t) => t.role === 'assistant')
                                            ? '请补充信息后发送'
                                            : '继续输入，进行多轮对话'
                                    }
                                    rows={2}
                                    className="w-full rounded-2xl border-surface-200 focus:border-primary-300 text-sm resize-none pr-12"
                                    disabled={isProcessing || isApplying}
                                />
                                <Button
                                    icon={isProcessing ? 'pi pi-spin pi-spinner' : 'pi pi-send'}
                                    className="absolute bottom-2 right-2 w-9 h-9 rounded-xl bg-surface-900 border-none text-surface-0 hover:bg-surface-800 active:scale-[0.95] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                    onClick={handleSendFollowUp}
                                    disabled={!instruction.trim() || isProcessing || isApplying || isResolvingPendingActions}
                                    aria-label="发送"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
    );

    if (effectiveVariant === 'panel') {
        if (!visible) return null;
        return (
            <div className="flex flex-col h-full min-h-0 w-full bg-surface">
                {content}
            </div>
        );
    }

    return (
        <Dialog
            header={null}
            visible={visible}
            onHide={handleHide}
            style={{ width: '95vw', maxWidth: '1400px' }}
            modal
            closable={!isProcessing && !isApplying}
            draggable={false}
            className="batch-operation-dialog-fullscreen"
            contentClassName="h-full"
        >
            {content}
        </Dialog>
    );
}
