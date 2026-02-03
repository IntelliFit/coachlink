'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { BatchOperationService } from '@/app/service/batchOperationService';
import { SSEMessage, ModificationDiff } from '@/app/api/plan-lib/batch-operation/entity';

interface BatchOperationDialogProps {
    visible: boolean;
    onHide: () => void;
    templateId: string;
    onSuccess?: () => void;
}

interface LogEntry {
    type: 'progress' | 'action_plan' | 'modification' | 'stats' | 'error' | 'success';
    content: string;
    timestamp: Date;
    data?: any;
}

/**
 * 批量操作对话框组件 - Aero 设计规范版
 * 1. 开发模式下显示token和耗时
 * 2. 不显示代码，只显示用户友好的描述
 * 3. 显示修改预览，让用户确认后再应用
 * 4. 遵循 Aero-Productivity 设计规范
 */
export function BatchOperationDialog({
    visible,
    onHide,
    templateId,
    onSuccess,
}: BatchOperationDialogProps) {
    const [instruction, setInstruction] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [previewData, setPreviewData] = useState<{
        originalTrainingDays: any;
        updatedTrainingDays: any;
        modifications: ModificationDiff[];
    } | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);

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
                addLog('progress', message.message);
                break;
            
            case 'action_plan':
                addLog('action_plan', `📋 ${message.plan}`);
                break;
            
            case 'modification':
                addLog('modification', `✏️ 第${message.dayIndex}天：${message.description}`);
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
                } else {
                    addLog('error', '操作失败');
                }
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

        setIsProcessing(true);
        setLogs([]);
        setPreviewData(null);

        await BatchOperationService.executeBatchOperation(
            templateId,
            instruction,
            handleMessage,
            () => {
                setIsProcessing(false);
            },
            (error) => {
                addLog('error', error);
                setIsProcessing(false);
            }
        );
    };

    // 应用修改到数据库
    const handleApply = async () => {
        if (!previewData) return;

        setIsApplying(true);
        try {
            const response = await fetch('/api/plan-lib/apply-batch-operation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    templateId,
                    updatedTrainingDays: previewData.updatedTrainingDays
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
            setLogs([]);
            setPreviewData(null);
            onHide();
        }
    };

    // 渲染日志条目
    const renderLogEntry = (entry: LogEntry, index: number) => {
        const timeStr = entry.timestamp.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });

        const getLogStyle = () => {
            switch (entry.type) {
                case 'progress':
                    return 'text-surface-700';
                case 'action_plan':
                    return 'text-surface-900 font-bold';
                case 'modification':
                    return 'text-primary-700 font-semibold';
                case 'stats':
                    return 'text-surface-500 text-xs';
                case 'success':
                    return 'text-green-700 font-bold';
                case 'error':
                    return 'text-red-600 font-semibold';
                default:
                    return 'text-surface-600';
            }
        };

        return (
            <div key={index} className="mb-2 flex items-start gap-2">
                {entry.type !== 'stats' && (
                    <span className="text-xs text-surface-400 shrink-0 mt-0.5 font-medium">
                        {timeStr}
                    </span>
                )}
                <span className={`text-sm ${getLogStyle()}`}>
                    {entry.content}
                </span>
            </div>
        );
    };

    return (
        <Dialog
            header="智能批量操作"
            visible={visible}
            onHide={handleHide}
            style={{ width: '90vw', maxWidth: '1000px' }}
            modal
            closable={!isProcessing && !isApplying}
            draggable={false}
            className="aero-dialog"
        >
            <div className="space-y-5">
                {/* 说明提示 */}
                <Card className="rounded-2xl border border-primary-100 bg-primary-50/30">
                    <div className="p-4 flex items-start gap-3">
                        <div className="shrink-0 w-8 h-8 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center">
                            <i className="pi pi-info-circle text-sm"></i>
                        </div>
                        <div className="min-w-0 text-sm text-surface-700">
                            <div className="font-bold mb-1">智能识别与预览</div>
                            <div className="text-surface-600 leading-relaxed">
                                使用自然语言描述批量操作，系统会自动识别并预览修改内容，确认后再应用到训练计划
                            </div>
                        </div>
                    </div>
                </Card>

                {/* 指令输入 */}
                <div className="space-y-2">
                    <label htmlFor="instruction" className="block text-sm font-bold text-surface-900">
                        操作指令
                    </label>
                    <InputTextarea
                        id="instruction"
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        rows={3}
                        className="w-full rounded-2xl border-surface-200 focus:border-primary-300 text-sm"
                        placeholder="例如: 把所有深蹲改为5组8次，重量100kg"
                        disabled={isProcessing || !!previewData}
                    />
                </div>

                {/* 日志显示区域 */}
                {logs.length > 0 && (
                    <Card className="rounded-2xl border border-surface-100 bg-surface-50">
                        <div className="p-4 max-h-64 overflow-y-auto">
                            <div className="space-y-1">
                                {logs.map((entry, index) => renderLogEntry(entry, index))}
                                <div ref={logsEndRef} />
                            </div>
                        </div>
                    </Card>
                )}

                {/* 修改预览表格 */}
                {previewData && previewData.modifications.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-surface-100 text-surface-700 flex items-center justify-center">
                                <i className="pi pi-list text-sm"></i>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-surface-900">
                                    修改预览
                                </h3>
                                <p className="text-xs text-surface-500">
                                    共识别到 {previewData.modifications.length} 处修改
                                </p>
                            </div>
                        </div>
                        <Card className="rounded-2xl border border-surface-100">
                            <DataTable
                                value={previewData.modifications}
                                scrollable
                                scrollHeight="300px"
                                className="text-sm aero-datatable"
                            >
                                <Column
                                    field="dayIndex"
                                    header="训练日"
                                    style={{ width: '80px' }}
                                    body={(row) => (
                                        <span className="font-bold text-surface-900">第{row.dayIndex}天</span>
                                    )}
                                />
                                <Column
                                    field="actionName"
                                    header="动作/项目"
                                    style={{ minWidth: '120px' }}
                                    body={(row) => (
                                        <span className="font-semibold text-surface-800">{row.actionName}</span>
                                    )}
                                />
                                <Column
                                    field="field"
                                    header="修改项"
                                    style={{ width: '100px' }}
                                    body={(row) => (
                                        <span className="text-xs text-surface-600">{row.field}</span>
                                    )}
                                />
                                <Column
                                    field="oldValue"
                                    header="原值"
                                    style={{ minWidth: '120px' }}
                                    body={(row) => (
                                        <span className="text-surface-500 line-through text-xs">
                                            {typeof row.oldValue === 'object' ? JSON.stringify(row.oldValue) : row.oldValue}
                                        </span>
                                    )}
                                />
                                <Column
                                    header="→"
                                    style={{ width: '40px', textAlign: 'center' }}
                                    body={() => <span className="text-surface-400">→</span>}
                                />
                                <Column
                                    field="newValue"
                                    header="新值"
                                    style={{ minWidth: '120px' }}
                                    body={(row) => (
                                        <span className="text-primary-700 font-bold text-xs">
                                            {typeof row.newValue === 'object' ? JSON.stringify(row.newValue) : row.newValue}
                                        </span>
                                    )}
                                />
                            </DataTable>
                        </Card>
                    </div>
                )}

                {/* 操作按钮 */}
                <div className="flex justify-between items-center pt-3">
                    <div>
                        {previewData && (
                            <Button
                                label="重新分析"
                                icon="pi pi-refresh"
                                text
                                severity="secondary"
                                className="rounded-2xl text-surface-600 hover:text-surface-900 hover:bg-surface-50 active:scale-[0.98] transition-all"
                                onClick={() => {
                                    setPreviewData(null);
                                    setLogs([]);
                                }}
                                disabled={isProcessing || isApplying}
                            />
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            label="取消"
                            text
                            severity="secondary"
                            className="rounded-2xl px-5 text-surface-700 hover:bg-surface-50 active:scale-[0.98] transition-all"
                            onClick={handleHide}
                            disabled={isProcessing || isApplying}
                        />
                        {!previewData ? (
                            <Button
                                label={isProcessing ? '分析中...' : '开始分析'}
                                icon={isProcessing ? undefined : 'pi pi-search'}
                                className="rounded-2xl px-5 bg-surface-900 border-none text-surface-0 font-bold hover:bg-surface-800 active:scale-[0.98] transition-all shadow-sm"
                                onClick={handleExecute}
                                disabled={!instruction.trim() || isProcessing}
                                loading={isProcessing}
                            />
                        ) : (
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
            </div>
        </Dialog>
    );
}
