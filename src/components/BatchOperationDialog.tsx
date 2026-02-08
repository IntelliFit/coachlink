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
import { BatchOperationService } from '@/app/service/batchOperationService';
import { SSEMessage, ModificationDiff, NewActionDetected, ConversationTurn } from '@/app/api/plan-lib/batch-operation/entity';
import MarkdownIt from 'markdown-it';

let DOMPurify: any;
if (typeof window !== 'undefined') {
    DOMPurify = require('dompurify').default || require('dompurify');
}

interface BatchOperationDialogProps {
    visible: boolean;
    onHide: () => void;
    templateId: string;
    onSuccess?: () => void;
    /** modal=弹窗 panel=右侧面板 auto=桌面用面板/移动用弹窗 */
    variant?: 'modal' | 'panel' | 'auto';
    /** 收到 preview_result 时回调，用于在左侧编辑器中展示修改并高亮 */
    onPreviewResult?: (data: { originalTrainingDays: any; updatedTrainingDays: any; modifications: ModificationDiff[] }) => void;
    /** 用户点击「清空」时回调，用于恢复左侧编辑器为原始数据 */
    onRestart?: () => void;
    /** 确认应用时，优先使用此函数返回的 days（左侧编辑器的当前数据） */
    onGetDaysToApply?: () => any[] | null;
}

interface LogEntry {
    type: 'progress' | 'action_plan' | 'stats' | 'error' | 'success' | 'need_clarification' | 'new_actions';
    content: string;
    timestamp: Date;
    data?: any;
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
    onSuccess,
    variant = 'modal',
    onPreviewResult,
    onRestart,
    onGetDaysToApply,
}: BatchOperationDialogProps) {
    const isDesktop = useIsDesktop();
    const effectiveVariant = variant === 'auto' ? (isDesktop ? 'panel' : 'modal') : variant;
    const [instruction, setInstruction] = useState('');
    const [submittedInstruction, setSubmittedInstruction] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [previewData, setPreviewData] = useState<{
        originalTrainingDays: any;
        updatedTrainingDays: any;
        modifications: ModificationDiff[];
    } | null>(null);
    const [queryAnswer, setQueryAnswer] = useState<string | null>(null);
    const [hasStarted, setHasStarted] = useState(false);
    const [editedModifications, setEditedModifications] = useState<ModificationDiff[]>([]);
    const [newActionsDetected, setNewActionsDetected] = useState<NewActionDetected[] | null>(null);
    const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
    const [clarificationSuggestions, setClarificationSuggestions] = useState<string[] | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<any>(null);

    // Markdown 渲染器
    const md = useMemo(() => new MarkdownIt({ html: true, linkify: true, typographer: true }), []);

    // 检查是否为开发模式
    const isDevelopment = process.env.NODE_ENV === 'development';

    // 自动滚动到日志底部
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // 添加日志条目
    const addLog = (type: LogEntry['type'], content: string, data?: any) => {
        setLogs(prev => [...prev, { type, content, timestamp: new Date(), data }]);
    };

    // 处理 SSE 消息
    const handleMessage = (message: SSEMessage) => {
        switch (message.type) {
            case 'progress':
                // 不展示「加载训练计划」「加载动作库」等前置步骤，保持界面简洁
                if (message.message !== '正在加载训练计划' && message.message !== '正在加载动作库') {
                    addLog('progress', message.message);
                }
                break;
            
            case 'action_plan':
                addLog('action_plan', `📋 ${message.plan}`);
                break;

            case 'need_clarification':
                addLog('need_clarification', message.question);
                setConversationHistory((prev) => [...prev, { role: 'assistant', content: message.question }]);
                setClarificationSuggestions(message.suggestions?.length ? message.suggestions : null);
                break;

            case 'new_actions_detected':
                setNewActionsDetected(message.actions);
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
                    setPreviewData({
                        originalTrainingDays: message.originalTrainingDays,
                        updatedTrainingDays: message.updatedTrainingDays,
                        modifications: message.modifications
                    });
                    setEditedModifications(message.modifications);
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
                setQueryAnswer(message.answer);
                break;
            
            case 'error':
                addLog('error', `❌ ${message.message}`);
                break;
        }
    };

    // 执行批量操作（只预览，不保存）
    const handleExecute = async () => {
        if (!instruction.trim()) {
            return;
        }

        setHasStarted(true);
        setSubmittedInstruction(instruction);
        setIsProcessing(true);
        setLogs([]);
        setPreviewData(null);
        setQueryAnswer(null);
        setNewActionsDetected(null);
        setConversationHistory([]);
        setClarificationSuggestions(null);

        await BatchOperationService.executeBatchOperation(
            templateId,
            instruction,
            handleMessage,
            () => setIsProcessing(false),
            (error) => {
                addLog('error', error);
                setIsProcessing(false);
            },
            []
        );
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
        addLog('progress', `已收到您的补充：${trimmed}`);
        setInstruction('');
        setIsProcessing(true);

        await BatchOperationService.executeBatchOperation(
            templateId,
            submittedInstruction,
            handleMessage,
            () => setIsProcessing(false),
            (error) => {
                addLog('error', error);
                setIsProcessing(false);
            },
            nextHistory
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

    // 应用修改到数据库
    const handleApply = async () => {
        if (!previewData) return;

        // 若计划中包含不在动作库中的动作，先确认
        if (newActionsDetected && newActionsDetected.length > 0) {
            const namesList = newActionsDetected.map((a) => a.suggestedName || a.actionId).join('、');
            const confirmed = window.confirm(
                `修改计划中包含以下不在您动作库中的动作：${namesList}。\n\n应用后这些动作在计划中可能显示为「未知动作」，直至您在动作库中创建对应动作。\n\n是否仍要应用计划？`
            );
            if (!confirmed) return;
        }

        setIsApplying(true);
        try {
            // 优先使用左侧编辑器的当前数据（用户可能已微调），否则使用服务端返回的 updatedTrainingDays
            const daysToApply = onGetDaysToApply?.() ?? previewData.updatedTrainingDays;
            const response = await fetch('/api/plan-lib/apply-batch-operation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    templateId,
                    updatedTrainingDays: daysToApply
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
        if (!isProcessing && !isApplying) {
            setInstruction('');
            setSubmittedInstruction('');
            setLogs([]);
            setPreviewData(null);
            setQueryAnswer(null);
            setHasStarted(false);
            setEditedModifications([]);
            setNewActionsDetected(null);
            setConversationHistory([]);
            setClarificationSuggestions(null);
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
        setEditedModifications([]);
        setNewActionsDetected(null);
        setConversationHistory([]);
        setClarificationSuggestions(null);
    };

    // 渲染日志条目
    const renderLogEntry = (entry: LogEntry, index: number) => {
        const timeStr = entry.timestamp.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });

        const getLogIcon = () => {
            // 检查是否是最后一条日志，且类型为 progress
            const isLastEntry = index === logs.length - 1;
            
            switch (entry.type) {
                case 'progress':
                    // 只有最后一条 progress 消息才显示旋转图标
                    return isLastEntry ? 'pi-spin pi-spinner' : 'pi-check';
                case 'action_plan':
                    return 'pi-list';
                case 'stats':
                    return 'pi-chart-bar';
                case 'success':
                    return 'pi-check-circle';
                case 'error':
                    return 'pi-exclamation-circle';
                case 'need_clarification':
                    return 'pi-question-circle';
                case 'new_actions':
                    return 'pi-plus-circle';
                default:
                    return 'pi-info-circle';
            }
        };

        const icon = getLogIcon();

        // 错误 / 需补全 / 新动作提醒 使用突出样式
        const isError = entry.type === 'error';
        const isClarification = entry.type === 'need_clarification';
        const isNewActions = entry.type === 'new_actions';
        const isWarning = isClarification || isNewActions;

        return (
            <div
                key={index}
                className={`
                    ${isError 
                        ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/30' 
                        : isWarning
                        ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/30'
                        : 'bg-surface-50 border-surface-200'
                    }
                    border rounded-xl px-3 py-2
                    flex items-center gap-2.5
                    log-entry-animation
                `}
                style={{
                    animationDelay: `${index * 50}ms`,
                }}
            >
                {/* 图标 */}
                <div className={`shrink-0 ${
                    isError ? 'text-red-500' 
                    : isWarning ? 'text-amber-600 dark:text-amber-400' 
                    : 'text-surface-400 dark:text-surface-500'
                }`}>
                    <i className={`pi ${icon} text-xs`}></i>
                </div>
                
                {/* 内容 */}
                <div className={`flex-1 min-w-0 text-xs font-medium leading-relaxed ${
                    isError 
                        ? 'text-red-700 dark:text-red-300' 
                        : isWarning 
                        ? 'text-amber-800 dark:text-amber-200' 
                        : 'text-surface-700 dark:text-surface-500'
                }`}>
                    {entry.content}
                </div>

                {/* 时间戳 - 右侧 */}
                {entry.type !== 'stats' && (
                    <div className={`shrink-0 text-[10px] font-medium tabular-nums ${
                        isError 
                            ? 'text-red-400 dark:text-red-500' 
                            : isWarning 
                            ? 'text-amber-600 dark:text-amber-500' 
                            : 'text-surface-400 dark:text-surface-500'
                    }`}>
                        {timeStr}
                    </div>
                )}
            </div>
        );
    };

    const content = (
        <div className="flex flex-col h-full">
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
                            </div>

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
                            <div className="text-center text-xs text-surface-400">
                                按 Enter 发送，Shift + Enter 换行
                            </div>
                        </div>
                    </div>
                )}

                {/* 已开始状态：显示对话内容 */}
                {hasStarted && (
                    <div className="flex flex-col h-full">
                        {/* Header：左侧返回，右侧清空 + 确认应用 */}
                        <div className="flex-shrink-0 px-8 pt-6 pb-4 flex items-center justify-between">
                            <Button
                                icon="pi pi-arrow-left"
                                text
                                severity="secondary"
                                className="rounded-2xl text-surface-600 hover:text-surface-900 hover:bg-surface-50 active:scale-[0.98] transition-all -ml-2"
                                onClick={handleHide}
                                disabled={isProcessing || isApplying}
                                aria-label="关闭"
                                tooltip="关闭对话框"
                                tooltipOptions={{ position: 'right' }}
                            />
                            <div className="flex items-center gap-2">
                                <Button
                                    label="清空"
                                    icon="pi pi-trash"
                                    text
                                    severity="secondary"
                                    className="rounded-2xl text-surface-600 hover:text-surface-900 hover:bg-surface-50 active:scale-[0.98] transition-all"
                                    onClick={handleRestart}
                                    disabled={isProcessing || isApplying}
                                />
                                {previewData && (
                                    <Button
                                        label={isApplying ? '应用中...' : '确认应用'}
                                        icon={isApplying ? undefined : 'pi pi-check'}
                                        className="rounded-2xl px-5 bg-primary-600 border-none text-white font-bold hover:bg-primary-700 active:scale-[0.98] transition-all shadow-sm shadow-primary-200"
                                        onClick={handleApply}
                                        disabled={isApplying}
                                        loading={isApplying}
                                    />
                                )}
                            </div>
                        </div>

                        {/* 内容容器 */}
                        <div className="flex-1 min-h-0 px-8 pb-6 flex flex-col">
                            {/* 用户消息 */}
                            <div className="flex-shrink-0 mb-6">
                                <div className="bg-surface-50 rounded-2xl p-4 border border-surface-100">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center flex-shrink-0 font-bold text-sm">
                                            你
                                        </div>
                                        <div className="flex-1 text-surface-900 text-sm leading-relaxed pt-1">
                                            {submittedInstruction}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 内容区域 */}
                            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
                                {/* 日志显示区域 */}
                                {logs.length > 0 && (
                                    <div className="space-y-2">
                                        {logs.map((entry, index) => renderLogEntry(entry, index))}
                                        <div ref={logsEndRef} />
                                    </div>
                                )}

                                {/* 查询结果展示 */}
                                {queryAnswer && (
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                                                <i className="pi pi-sparkles text-sm"></i>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="bg-surface-50 dark:bg-surface-800 rounded-2xl p-4 border border-surface-100 dark:border-surface-700">
                                                    <div className="prose prose-sm max-w-none text-surface-700 dark:text-surface-300 markdown-message-content">
                                                        <div 
                                                            className="text-sm leading-relaxed"
                                                            dangerouslySetInnerHTML={{ 
                                                                __html: DOMPurify?.sanitize(md.render(queryAnswer || ''))
                                                            }} 
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 修改已直接施加于左侧编辑器，此处不再展示表格 */}
                            </div>
                        </div>

                        {/* 底部：推荐选项（若有）+ 输入框（内嵌发送按钮） */}
                        <div className="flex-shrink-0 border-t border-surface-100 dark:border-surface-700 px-8 pt-4 pb-6">
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
                                            ? '请补充信息后发送，例如：跑步、跳绳、骑行…'
                                            : '继续输入并发送，进行多轮对话'
                                    }
                                    rows={2}
                                    className="w-full rounded-2xl border-surface-200 focus:border-primary-300 text-sm resize-none pr-12"
                                    disabled={isProcessing || isApplying}
                                />
                                <Button
                                    icon={isProcessing ? 'pi pi-spin pi-spinner' : 'pi pi-send'}
                                    className="absolute bottom-2 right-2 w-9 h-9 rounded-xl bg-surface-900 border-none text-surface-0 hover:bg-surface-800 active:scale-[0.95] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                    onClick={handleSendFollowUp}
                                    disabled={!instruction.trim() || isProcessing || isApplying}
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
            style={{ width: '95vw', height: '90vh', maxWidth: '1400px' }}
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
