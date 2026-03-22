'use client';

import React, { useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { useRouter } from 'next/navigation';
import { CheckCircle, Info, Play, RotateCcw, Video } from 'lucide-react';
import {
    buildDayModuleModel,
    buildLightweightSummary,
    buildStrengthMeta,
    type ExecutionStatus,
    type NormalizedDayTask,
} from './lib/dayModules';
import { formatBeijingDate } from '@/lib/beijingTime';

interface TodayTrainingCardProps {
    day: any;
    actions: Record<string, any>;
    instanceId: string;
    dayIndex: number;
    executionStatus?: ExecutionStatus;
    execution?: any;
    heading?: string;
    subheading?: string;
    dateLabel?: string | null;
    onOpenLightweightTask?: (task: NormalizedDayTask) => void;
    onAddLightweightTask?: () => void;
    onDeleteLightweightTask?: (task: NormalizedDayTask) => void;
}

const TodayTrainingCard: React.FC<TodayTrainingCardProps> = ({
    day,
    actions,
    instanceId,
    dayIndex,
    executionStatus = 'none',
    execution,
    heading = '今日安排',
    subheading,
    dateLabel,
    onOpenLightweightTask,
    onAddLightweightTask,
    onDeleteLightweightTask,
}) => {
    const router = useRouter();
    const [showAllTasks, setShowAllTasks] = useState(false);
    const [infoDialog, setInfoDialog] = useState<{ title: string; detail: string } | null>(null);
    const moduleModel = useMemo(() => buildDayModuleModel({
        day,
        actions,
        execution,
        executionStatus,
    }), [day, actions, execution, executionStatus]);

    const {
        strengthTasks,
        lightweightTasks,
        lightweightGroups,
        moduleCount,
        completedModuleCount,
        remainingModuleCount,
        dayCompleted,
        strengthCompleted,
        trainingCompleted,
        trainingInProgress,
        strengthCompletedSetCount,
        strengthTotalSetCount,
        lightweightCompletedCount,
    } = moduleModel;
    const hasStrengthTasks = strengthTasks.length > 0;

    const previewGroups = useMemo(() => {
        if (showAllTasks) return lightweightGroups;
        const maxCards = 4;
        let used = 0;
        return lightweightGroups
            .map((group) => {
                if (used >= maxCards) return { ...group, items: [] };
                const remain = maxCards - used;
                const nextItems = group.items.slice(0, remain);
                used += nextItems.length;
                return { ...group, items: nextItems };
            })
            .filter((group) => group.items.length > 0);
    }, [lightweightGroups, showAllTasks]);

    const lightweightHiddenCount = Math.max(
        0,
        lightweightTasks.length - previewGroups.reduce((sum, group) => sum + group.items.length, 0),
    );

    const openExecution = (focusAction?: number) => {
        const focusQuery = typeof focusAction === 'number' ? `&focusAction=${focusAction}` : '';
        router.push(`/training-execution/${instanceId}?dayIndex=${dayIndex}${focusQuery}`);
    };

    const headerSubtitle = subheading || `第${dayIndex}天 · ${moduleCount} 个任务模块`;
    const displayDateLabel = dateLabel || (heading === '今日安排'
        ? formatBeijingDate(new Date(), 'zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
        : null);

    return (
        <div
            id="guide-today-card"
            className={`rounded-3xl border bg-surface p-4 sm:p-6 ${
                dayCompleted ? 'border-green-100/60 bg-green-50/20' : 'border-surface-100/60'
            }`}
        >
            <div className="space-y-5 sm:space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        {displayDateLabel && (
                            <div className="flex items-center gap-2 text-sm text-surface-500">
                                <span>📅</span>
                                <span>{displayDateLabel}</span>
                            </div>
                        )}
                        <h2 className="mt-2 text-2xl sm:text-3xl font-black text-surface-900 tracking-tight">
                            {heading}
                        </h2>
                        <p className="mt-2 text-sm text-surface-600">
                            {headerSubtitle}
                            {strengthTasks.length > 0 ? ` · ${strengthTasks.length} 个训练动作` : ''}
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:min-w-[420px]">
                        <div className="rounded-2xl border border-surface-100 bg-surface-50 px-3 py-3">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-surface-500">训练打卡</div>
                            <div className="mt-1 text-base font-black text-surface-900">
                                {!hasStrengthTasks ? '今日无力量训练' : trainingCompleted ? '已完成' : trainingInProgress ? '进行中' : '待开始'}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-green-100 bg-green-50 px-3 py-3">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-green-700">今日安排</div>
                            <div className="mt-1 text-base font-black text-green-800">
                                {moduleCount === 0 ? '暂无任务' : dayCompleted ? '已打卡完成' : `${completedModuleCount}/${moduleCount} 模块`}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-surface-100 bg-surface-50 px-3 py-3">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-surface-500">总模块</div>
                            <div className="mt-1 text-xl font-black text-surface-900">{moduleCount}</div>
                        </div>
                        <div className="rounded-2xl border border-primary-100 bg-primary-50 px-3 py-3">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-primary-700">剩余</div>
                            <div className="mt-1 text-xl font-black text-primary-800">{remainingModuleCount}</div>
                        </div>
                    </div>
                </div>

                {dayCompleted && (
                    <div className="rounded-2xl border border-green-100/60 bg-green-50 px-4 py-3 text-green-800">
                        <div className="flex items-center gap-2 font-bold tracking-tight">
                            <CheckCircle className="w-5 h-5" />
                            今日安排已完成
                        </div>
                        <div className="mt-1 text-sm text-green-700">
                            力量训练与轻量任务都已记录完成，稍后也可以回看训练和打卡记录。
                        </div>
                    </div>
                )}

                {hasStrengthTasks && (
                    <section className="rounded-3xl border border-primary-100/70 bg-gradient-to-br from-primary-50 to-white p-4 sm:p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                                <div className="inline-flex items-center gap-2 rounded-full bg-primary-100 px-3 py-1 text-xs font-bold text-primary-800">
                                    <span>训练模块</span>
                                    <span>STRENGTH</span>
                                </div>
                                <div className="mt-3 flex items-center gap-2">
                                    <h3 className="text-xl font-black text-surface-900 tracking-tight">连续力量训练</h3>
                                    {trainingCompleted ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                                            <CheckCircle className="w-3.5 h-3.5" />
                                            已完成
                                        </span>
                                    ) : trainingInProgress ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
                                            <RotateCcw className="w-3.5 h-3.5" />
                                            进行中
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2 py-0.5 text-xs font-bold text-surface-600">
                                            待开始
                                        </span>
                                    )}
                                </div>
                                <p className="mt-2 text-sm text-surface-600">
                                    力量训练进入专门执行页，集中处理重量、次数、RPE、休息、视频与 PR 记录。
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:min-w-[320px]">
                                <div className="rounded-2xl border border-surface-100 bg-surface px-3 py-3">
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-surface-500">动作</div>
                                    <div className="mt-1 text-lg font-black text-surface-900">{strengthTasks.length}</div>
                                </div>
                                <div className="rounded-2xl border border-surface-100 bg-surface px-3 py-3">
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-surface-500">计划组数</div>
                                    <div className="mt-1 text-lg font-black text-surface-900">{strengthTotalSetCount}</div>
                                </div>
                                <div className="col-span-2 rounded-2xl border border-surface-100 bg-surface px-3 py-3 sm:col-span-1">
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-surface-500">完成进度</div>
                                    <div className="mt-1 text-lg font-black text-surface-900">
                                        {strengthCompletedSetCount}/{strengthTotalSetCount}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {strengthTasks.slice(0, 4).map((task) => {
                                const meta = buildStrengthMeta(task);
                                return (
                                    <div
                                        key={task.index}
                                        className="rounded-2xl border border-surface-100/70 bg-white/90 px-4 py-3"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-bold text-surface-900">{task.title}</div>
                                                <div className="mt-1 text-xs text-surface-500">
                                                    {meta.summary}
                                                    {meta.loadText ? ` · ${meta.loadText}` : ''}
                                                    {meta.restText ? ` · ${meta.restText}` : ''}
                                                </div>
                                            </div>
                                            {task.demoVideoUrl && (
                                                <button
                                                    type="button"
                                                    onClick={() => window.open(task.demoVideoUrl || '', '_blank')}
                                                    className="rounded-2xl p-2 text-blue-600 transition-colors hover:bg-blue-50 active:scale-[0.98]"
                                                    title="查看演示视频"
                                                >
                                                    <Video className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                        {task.noteText && (
                                            <div className="mt-2 rounded-2xl border border-amber-200/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 line-clamp-2">
                                                {task.noteText}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                            {trainingCompleted ? (
                                <Button
                                    label="查看训练记录"
                                    icon={<CheckCircle className="w-5 h-5" />}
                                    onClick={() => openExecution()}
                                    className="w-full sm:w-auto"
                                    severity="secondary"
                                    outlined
                                />
                            ) : trainingInProgress ? (
                                <Button
                                    label="继续训练"
                                    icon={<Play className="w-5 h-5" />}
                                    onClick={() => openExecution()}
                                    className="w-full sm:w-auto"
                                    severity="warning"
                                />
                            ) : (
                                <Button
                                    id="guide-start-training"
                                    label="开始训练"
                                    icon={<Play className="w-5 h-5" />}
                                    onClick={() => openExecution()}
                                    className="w-full sm:w-auto"
                                    severity="success"
                                />
                            )}
                            <div className="flex-1 rounded-2xl border border-surface-100 bg-white/80 px-3 py-3 text-xs text-surface-600">
                                这里的主按钮只代表力量训练打卡；轻量任务在下方单独记录，但会一起汇总到今日安排进度。
                            </div>
                        </div>
                    </section>
                )}

                {(lightweightTasks.length > 0 || onAddLightweightTask) && (
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg sm:text-xl font-black text-surface-900 tracking-tight">轻量任务</h3>
                                <p className="text-sm text-surface-500">
                                    饮食、有氧和习惯单独执行，完成后会立即回写到当天进度。
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {lightweightTasks.length > 0 && (
                                    <div className="text-sm font-semibold text-surface-500">
                                        {lightweightCompletedCount}/{lightweightTasks.length} 已完成
                                    </div>
                                )}
                                {onAddLightweightTask && (
                                    <Button
                                        label="新增轻任务"
                                        icon="pi pi-plus"
                                        onClick={onAddLightweightTask}
                                        size="small"
                                        severity="secondary"
                                        outlined
                                    />
                                )}
                            </div>
                        </div>

                        {lightweightTasks.length === 0 ? (
                            <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50/70 px-4 py-6 text-center">
                                <div className="text-base font-bold text-surface-900">这一天还没有轻任务</div>
                                <div className="mt-2 text-sm text-surface-500">
                                    可以从你的动作库里追加饮食、有氧或习惯任务，单独记录，不影响力量训练页结构。
                                </div>
                                {onAddLightweightTask && (
                                    <Button
                                        label="去新增轻任务"
                                        icon="pi pi-plus"
                                        onClick={onAddLightweightTask}
                                        className="mt-4"
                                        severity="success"
                                    />
                                )}
                            </div>
                        ) : (
                            previewGroups.map((group) => (
                                <div key={group.slot} className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="h-px flex-1 bg-surface-100" />
                                        <div className="text-xs font-bold uppercase tracking-widest text-surface-400">{group.slot}</div>
                                        <div className="h-px flex-1 bg-surface-100" />
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                        {group.items.map((task) => {
                                            const meta = buildLightweightSummary(task);
                                            return (
                                                <div
                                                    key={`${task.executionIndex}-${task.actionId || task.title}`}
                                                    className={`rounded-3xl border p-4 ${meta.accent} ${task.isCompleted ? 'opacity-80' : ''}`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-lg">{meta.icon}</span>
                                                                <div className="truncate text-base font-black text-surface-900">{task.title}</div>
                                                            </div>
                                                            <div className="mt-2 line-clamp-2 text-sm text-surface-700">
                                                                {meta.summary}
                                                            </div>
                                                            <div className="mt-2 text-xs text-surface-500">
                                                                {meta.extra}
                                                            </div>
                                                        </div>
                                                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${
                                                            task.isCompleted
                                                                ? 'bg-green-100 text-green-700'
                                                                : 'bg-white/80 text-surface-600'
                                                        }`}>
                                                            {task.isCompleted ? '已打卡' : '待处理'}
                                                        </span>
                                                    </div>

                                                    {task.noteText && (
                                                        <div className="mt-3 rounded-2xl border border-amber-200/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 line-clamp-2">
                                                            {task.noteText}
                                                        </div>
                                                    )}

                                                    <div className="mt-4 flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-1">
                                                            {task.isStudentExtra && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onDeleteLightweightTask?.(task)}
                                                                    className="rounded-2xl p-2 text-red-600 transition-colors hover:bg-red-50 active:scale-[0.98]"
                                                                    title="删除该轻任务"
                                                                >
                                                                    <i className="pi pi-trash text-sm" />
                                                                </button>
                                                            )}
                                                            {task.detailText && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setInfoDialog({
                                                                        title: task.title,
                                                                        detail: task.detailText,
                                                                    })}
                                                                    className="rounded-2xl p-2 text-surface-600 transition-colors hover:bg-white/70 active:scale-[0.98]"
                                                                    title="查看任务说明"
                                                                >
                                                                    <Info className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <Button
                                                            label={meta.actionLabel}
                                                            onClick={() => onOpenLightweightTask?.(task)}
                                                            severity={task.isCompleted ? 'secondary' : 'success'}
                                                            outlined={task.isCompleted}
                                                            className="shrink-0"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        )}

                        {(lightweightHiddenCount > 0 || (showAllTasks && lightweightTasks.length > 4)) && (
                            <button
                                type="button"
                                onClick={() => setShowAllTasks((prev) => !prev)}
                                className="w-full rounded-2xl border border-surface-100/50 bg-surface py-3 font-medium text-surface-700 transition-all duration-200 ease-out hover:bg-surface-50 active:scale-[0.98]"
                            >
                                {showAllTasks ? '收起轻量任务' : `展开查看全部轻量任务（还有 ${lightweightHiddenCount} 项）`}
                            </button>
                        )}
                    </section>
                )}
            </div>

            <Dialog
                header={infoDialog?.title || '任务说明'}
                visible={!!infoDialog}
                onHide={() => setInfoDialog(null)}
                draggable={false}
                resizable={false}
                className="w-[min(92vw,520px)]"
            >
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-surface-700">
                    {infoDialog?.detail || ''}
                </div>
            </Dialog>
        </div>
    );
};

export default TodayTrainingCard;
