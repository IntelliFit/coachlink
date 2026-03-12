'use client';

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { AeroInputNumber } from '@/components/AeroInputNumber';
import { executionService } from '@/app/service/executionService';
import { useToastContext } from '@/context/ToastContext';
import type { NormalizedDayTask } from '../lib/dayModules';

interface LightweightTaskSheetProps {
    visible: boolean;
    task: NormalizedDayTask | null;
    instanceId: string;
    dayIndex: number;
    execution?: any;
    onHide: () => void;
    onCompleted: () => Promise<void> | void;
}

const LightweightTaskSheet: React.FC<LightweightTaskSheetProps> = ({
    visible,
    task,
    instanceId,
    dayIndex,
    execution,
    onHide,
    onCompleted,
}) => {
    const { showToast } = useToastContext();
    const [submitting, setSubmitting] = useState(false);
    const [dietContent, setDietContent] = useState('');
    const [cardioDistance, setCardioDistance] = useState<number | null>(null);
    const [cardioDuration, setCardioDuration] = useState<number | null>(null);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (!task) {
            setDietContent('');
            setCardioDistance(null);
            setCardioDuration(null);
            setNotes('');
            return;
        }

        const setData = task.executionItem?.sets?.[0];
        setDietContent(setData?.diet_content || '');
        setCardioDistance(
            typeof setData?.actual_distance === 'number'
                ? Math.round((setData.actual_distance / 1000) * 10) / 10
                : null,
        );
        setCardioDuration(
            typeof setData?.actual_duration === 'number'
                ? Math.round(setData.actual_duration / 60)
                : null,
        );
        setNotes(String(task.executionItem?.notes || setData?.notes || '').trim());
    }, [task]);

    const handleSubmit = async () => {
        if (!task) return;
        if (task.itemType === 'STRENGTH') return;
        try {
            setSubmitting(true);

            let executionId = execution?.id as string | undefined;
            if (!executionId) {
                const startRes = await executionService.startExecution({
                    instanceId,
                    dayIndex,
                });
                executionId = startRes?.data?.id;
            }

            if (!executionId) {
                throw new Error('无法创建当天执行记录');
            }

            const res = await executionService.completeItem({
                executionId,
                actionIndex: task.executionIndex,
                itemType: task.itemType,
                completed: true,
                actualContent: task.itemType === 'DIET' ? dietContent : undefined,
                actualDistance:
                    task.itemType === 'CARDIO' && cardioDistance
                        ? cardioDistance * 1000
                        : undefined,
                actualDuration:
                    task.itemType === 'CARDIO' && cardioDuration
                        ? cardioDuration * 60
                        : undefined,
                notes: notes || undefined,
            });

            if (!res) {
                throw new Error('保存失败');
            }

            showToast({
                severity: 'success',
                summary: '已完成',
                detail: `${task.title} 已更新`,
            });

            await onCompleted();
            onHide();
        } catch (error: any) {
            showToast({
                severity: 'error',
                summary: '保存失败',
                detail: error?.message || '请稍后重试',
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog
            header={task ? `${task.title} · 单独执行` : '轻任务执行'}
            visible={visible}
            onHide={onHide}
            draggable={false}
            resizable={false}
            className="w-[min(92vw,560px)]"
        >
            {!task ? null : (
                <div className="space-y-4">
                    <div className="rounded-2xl border border-surface-100 bg-surface-50 px-4 py-3">
                        <div className="text-sm font-bold text-surface-900">{task.title}</div>
                        <div className="mt-1 text-sm text-surface-600">
                            {task.detailText || task.noteText || '完成后即可回到今日安排继续推进。'}
                        </div>
                    </div>

                    {task.itemType === 'DIET' && (
                        <div>
                            <label className="mb-2 block text-sm font-medium text-surface-700">
                                饮食记录
                            </label>
                            <InputTextarea
                                value={dietContent}
                                onChange={(e) => setDietContent(e.target.value)}
                                rows={4}
                                className="w-full"
                                placeholder="记录吃了什么、分量或执行情况"
                            />
                        </div>
                    )}

                    {task.itemType === 'CARDIO' && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-surface-700">
                                    距离（km）
                                </label>
                                <AeroInputNumber
                                    value={cardioDistance}
                                    onValueChange={(e) => setCardioDistance(e.value ?? null)}
                                    min={0}
                                    max={200}
                                    minFractionDigits={1}
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-surface-700">
                                    时长（分钟）
                                </label>
                                <AeroInputNumber
                                    value={cardioDuration}
                                    onValueChange={(e) => setCardioDuration(e.value ?? null)}
                                    min={0}
                                    max={600}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    )}

                    {task.itemType === 'HABIT' && (
                        <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-800">
                            完成该习惯后点击保存即可。若有补充说明，可以写在下方备注里。
                        </div>
                    )}

                    <div>
                        <label className="mb-2 block text-sm font-medium text-surface-700">
                            备注（可选）
                        </label>
                        <InputTextarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="w-full"
                            placeholder="记录感受、结果或额外说明"
                        />
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button
                            label="取消"
                            severity="secondary"
                            outlined
                            onClick={onHide}
                            disabled={submitting}
                        />
                        <Button
                            label={submitting ? '保存中...' : (task.isCompleted ? '更新记录' : '完成打卡')}
                            onClick={handleSubmit}
                            disabled={submitting}
                            severity="success"
                        />
                    </div>
                </div>
            )}
        </Dialog>
    );
};

export default LightweightTaskSheet;
