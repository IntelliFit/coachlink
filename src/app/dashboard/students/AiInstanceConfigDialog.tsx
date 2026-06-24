'use client';

import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { InputSwitch } from 'primereact/inputswitch';
import { useState } from 'react';

export interface AiInstanceConfig {
    startWeek: number;
    startDay: number;
    keepOriginalIndex: boolean; // 保留字段兼容性，但始终为 true
    useLLM: boolean;
}

interface AiInstanceConfigDialogProps {
    visible: boolean;
    studentName?: string;
    /** 模板总周数，用于生成周选项 */
    totalWeeks?: number;
    onHide: () => void;
    onConfirm: (config: AiInstanceConfig) => void;
    loading?: boolean;
    errorMessage?: string | null;
    manualActionLabel?: string;
    onManualAction?: () => void;
}

export function AiInstanceConfigDialog({
    visible,
    studentName,
    totalWeeks = 12,
    onHide,
    onConfirm,
    loading = false,
    errorMessage,
    manualActionLabel = '改用手动创建',
    onManualAction,
}: AiInstanceConfigDialogProps) {
    const [startWeek, setStartWeek] = useState<number>(1);
    const [startDay, setStartDay] = useState<number>(1);
    const [useLLM, setUseLLM] = useState<boolean>(false);

    // 生成周选项
    const weekOptions = Array.from({ length: totalWeeks }, (_, i) => ({
        label: `第 ${i + 1} 周`,
        value: i + 1,
    }));

    // 生成天选项（1-7）
    const dayOptions = [
        { label: '第 1 天', value: 1 },
        { label: '第 2 天', value: 2 },
        { label: '第 3 天', value: 3 },
        { label: '第 4 天', value: 4 },
        { label: '第 5 天', value: 5 },
        { label: '第 6 天', value: 6 },
        { label: '第 7 天', value: 7 },
    ];

    const handleConfirm = () => {
        onConfirm({
            startWeek,
            startDay,
            keepOriginalIndex: true, // 始终保留原始编号
            useLLM,
        });
    };

    const handleHide = () => {
        // 重置状态
        setStartWeek(1);
        setStartDay(1);
        setUseLLM(false);
        onHide();
    };

    // 计算起始天数
    const startDayNum = (startWeek - 1) * 7 + startDay;
    const isFromBeginning = startWeek === 1 && startDay === 1;

    const footer = (
        <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
                {onManualAction && (
                    <Button
                        label={manualActionLabel}
                        icon="pi pi-pencil"
                        onClick={onManualAction}
                        className="p-button-outlined p-button-secondary"
                        disabled={loading}
                    />
                )}
            </div>
            <div className="flex items-center gap-2 ml-auto">
                <Button
                    label="取消"
                    icon="pi pi-times"
                    onClick={handleHide}
                    className="p-button-text"
                    disabled={loading}
                />
                <Button
                    label={loading ? '生成中...' : '确认生成'}
                    icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
                    onClick={handleConfirm}
                    disabled={loading}
                />
            </div>
        </div>
    );

    return (
        <Dialog
            visible={visible}
            onHide={handleHide}
            header={
                <div className="flex items-center gap-2">
                    <i className="pi pi-cog text-primary" />
                    <span>智能生成配置</span>
                </div>
            }
            footer={footer}
            className="w-full max-w-md"
            modal
            closable={!loading}
        >
            <div className="flex flex-col gap-4 p-2">
                {studentName && (
                    <div className="text-surface-600 text-sm">
                        为学员 <span className="font-medium text-surface-900">{studentName}</span> 生成训练计划
                    </div>
                )}

                {errorMessage && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-xs leading-relaxed text-red-700">
                        <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
                            <i className="pi pi-exclamation-circle" />
                            智能生成失败
                        </div>
                        <div className="mt-1">{errorMessage}</div>
                        {onManualAction && (
                            <div className="mt-2 text-red-700/90">
                                你可以直接点下方“{manualActionLabel}”继续，不用等 AI 恢复。
                            </div>
                        )}
                    </div>
                )}

                <div className="bg-surface-50 p-4 rounded-lg border border-surface-200">
                    <div className="text-sm font-medium text-surface-700 mb-3">
                        计划起始位置
                    </div>
                    <div className="text-xs text-surface-500 mb-3">
                        如果学员已经在线下完成了部分训练，可以选择从指定位置开始执行
                    </div>
                    
                    <div className="flex gap-3 items-center">
                        <div className="flex-1">
                            <label className="block text-xs text-surface-500 mb-1">起始周</label>
                            <Dropdown
                                value={startWeek}
                                options={weekOptions}
                                onChange={(e) => setStartWeek(e.value)}
                                className="w-full"
                                disabled={loading}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs text-surface-500 mb-1">起始天</label>
                            <Dropdown
                                value={startDay}
                                options={dayOptions}
                                onChange={(e) => setStartDay(e.value)}
                                className="w-full"
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {!isFromBeginning && (
                        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                            <i className="pi pi-info-circle mr-1" />
                            学员将从第 {startWeek} 周第 {startDay} 天开始执行，前 {startDayNum - 1} 天视为已完成
                        </div>
                    )}
                </div>

                <div className="bg-surface-50 p-4 rounded-lg border border-surface-200">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <div className="text-sm font-medium text-surface-700">
                                    AI 深度个性化
                                </div>
                                <span className={[
                                    'rounded-full px-2 py-0.5 text-[11px] font-bold',
                                    useLLM ? 'bg-primary-50 text-primary-700' : 'bg-surface-100 text-surface-500',
                                ].join(' ')}>
                                    {useLLM ? '已开启' : '已关闭'}
                                </span>
                            </div>
                            <div className="mt-2 text-xs text-surface-500 leading-relaxed">
                                开启后会让 LLM 分析学员问卷、档案和 PR 记录，自动选择模板并调整训练内容。
                            </div>
                        </div>
                        <InputSwitch
                            checked={useLLM}
                            onChange={(e) => setUseLLM(e.value)}
                            disabled={loading}
                            aria-label="AI 深度个性化"
                            className="shrink-0"
                        />
                    </div>
                </div>

                <div className="text-xs text-surface-500 bg-surface-100 p-3 rounded">
                    <i className="pi pi-lightbulb mr-1 text-amber-500" />
                    <strong>提示：</strong>完整的训练计划将被保留，学员端会自动跳转到起始位置继续执行。
                </div>
            </div>
        </Dialog>
    );
}
