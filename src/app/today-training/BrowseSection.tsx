'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Check, Play, Eye, Info } from 'lucide-react';
import { calculateCurrentWeek, isDayUnlocked, getDayWeekNumber, formatUnlockDate, getUnlockDate } from '@/lib/weekUnlock';
import { formatKgValueForGym } from '@/lib/weightQuantize';

interface BrowseSectionProps {
    instance: any;
    actions: Record<string, any>;
    currentDayIndex: number;
    todayExecutionStatus?: 'none' | 'in_progress' | 'completed';
    completionDates?: Record<number, string>;  // 每个训练日的完成日期
    executionsByDayIndex?: Record<number, any>; // dayIndex -> execution (latest started_at per day)
    todayCompleted?: boolean;                  // 今天是否已完成训练
    initialSelectedDayIndex?: number;          // 默认选中的推进日（用于“今天推进”定格）
    progressDayIndex?: number;                 // 今日推进日 dayIndex（用于高亮/锚点）
    effectiveStartDate?: string | Date | null; // 实际生效的开始日期（用于解锁计算）
}

const BrowseSection: React.FC<BrowseSectionProps> = ({
    instance,
    actions,
    currentDayIndex,
    todayExecutionStatus = 'none',
    completionDates = {},
    executionsByDayIndex = {},
    todayCompleted = false,
    initialSelectedDayIndex,
    progressDayIndex,
    effectiveStartDate
}) => {
    const router = useRouter();
    const [selectedDayIndex, setSelectedDayIndex] = useState(initialSelectedDayIndex || currentDayIndex);
    const [infoDialog, setInfoDialog] = useState<{ title: string; detail: string } | null>(null);

    // 当外部“今天日历日”变化时，同步定格到该日（不打断用户手动切换：仅在初始化/切换计划时生效）
    useEffect(() => {
        if (!initialSelectedDayIndex) return;
        setSelectedDayIndex(initialSelectedDayIndex);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialSelectedDayIndex, instance?.id]);
    
    const trainingDays = (instance?.training_days || []) as any[];
    const startExecutionDay = instance?.start_execution_day || 1;
    
    // 计算总周数
    const totalWeeks = Math.ceil(trainingDays.length / 7);
    
    // 根据当前选中的天计算当前显示的周
    // 优先使用日历日(initialSelectedDayIndex)，否则使用推荐训练日(currentDayIndex)
    const [currentWeek, setCurrentWeek] = useState(() => {
        const anchorDay = initialSelectedDayIndex || currentDayIndex;
        const startWeek = Math.ceil(anchorDay / 7);
        return Math.max(1, Math.min(startWeek, totalWeeks));
    });
    
    // 🔒 计算已解锁的周次（基于计划开始日期）
    const unlockedWeek = useMemo(() => {
        // 优先使用传入的 effectiveStartDate，回退到 instance.start_date
        const startDate = effectiveStartDate || instance?.start_date;
        const byDate = calculateCurrentWeek(startDate);
        // For migrated students, start_execution_day should unlock to that week even if start_date is null/too recent.
        const byStartExecution = getDayWeekNumber(startExecutionDay || 1);
        return Math.max(byDate, byStartExecution);
    }, [effectiveStartDate, instance?.start_date, startExecutionDay]);
    
    // 计算当前周的训练日范围
    const weekDays = useMemo(() => {
        const startDay = (currentWeek - 1) * 7 + 1;
        const endDay = currentWeek * 7;
        return Array.from({ length: 7 }, (_, i) => startDay + i).filter(d => d <= trainingDays.length);
    }, [currentWeek, trainingDays.length]);
    
    // 检查当前显示的周是否已解锁
    const isCurrentWeekUnlocked = currentWeek <= unlockedWeek;
    
    const selectedDay = trainingDays.find(d => d.dayIndex === selectedDayIndex);

    const getExec = (dayIndex: number) => (executionsByDayIndex || {})[dayIndex];

    // 检查训练日是否已完成（事实：completed 状态）
    const isDayCompleted = (dayIndex: number): boolean => {
        return getExec(dayIndex)?.status === 'completed';
    };

    // 获取训练日的真实日期（事实日期）：completed 用 completed_at，in_progress 用 started_at；未开始不显示
    const getActualDateLabel = (dayIndex: number): string | null => {
        const exec = getExec(dayIndex);
        const ts = exec?.status === 'completed'
            ? exec?.completed_at
            : exec?.status === 'in_progress'
                ? exec?.started_at
                : null;
        if (!ts) return null;
        const dt = new Date(ts);
        return dt.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
    };

    const handlePrevWeek = () => {
        if (currentWeek > 1) {
            setCurrentWeek(currentWeek - 1);
        }
    };

    const handleNextWeek = () => {
        if (currentWeek < totalWeeks) {
            setCurrentWeek(currentWeek + 1);
        }
    };

    return (
        <div className="mt-6 sm:mt-8">
            <div className="bg-surface border rounded-2xl border-surface-100/50 p-4 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4">
                    <h3 className="text-lg sm:text-xl font-bold text-surface-900 tracking-tight">浏览训练日</h3>
                    <div className="flex items-center justify-between sm:justify-end gap-2">
                        <Button
                            icon={<ChevronLeft className="w-4 h-4" />}
                            onClick={handlePrevWeek}
                            disabled={currentWeek === 1}
                            className="p-button-text p-button-sm"
                        />
                        <span className={`text-sm flex items-center gap-1.5 ${isCurrentWeekUnlocked ? 'text-surface-600' : 'text-amber-500'}`}>
                            第 {currentWeek} 周
                            {!isCurrentWeekUnlocked && <i className="pi pi-pencil text-xs text-amber-400" />}
                        </span>
                        <Button
                            icon={<ChevronRight className="w-4 h-4" />}
                            onClick={handleNextWeek}
                            disabled={currentWeek === totalWeeks}
                            className="p-button-text p-button-sm"
                        />
                    </div>
                </div>

                {/* 仅展示推进口径：不再显示“今日（日历）”块，避免误解 */}
                
                {/* Week Calendar */}
                <div className="bg-surface-50 rounded-2xl p-2 sm:p-3 mb-4 relative">
                    {/* 📝 制定中周遮罩 */}
                    {!isCurrentWeekUnlocked && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-surface-900/10 backdrop-blur-sm rounded-2xl">
                            <div className="bg-surface/90 rounded-2xl p-6 border border-surface-100/50 text-center max-w-xs">
                                <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <i className="pi pi-pencil text-2xl text-amber-600" />
                                </div>
                                <h4 className="text-lg font-bold text-surface-900 mb-1 tracking-tight">第 {currentWeek} 周内容制定中</h4>
                                <p className="text-sm text-surface-600 mb-2">
                                    {(() => {
                                        const unlockDate = getUnlockDate(currentWeek, instance?.start_date);
                                        if (unlockDate) {
                                            return `预计 ${formatUnlockDate(unlockDate)} 发布`;
                                        }
                                        return '教练正在为您精心准备训练内容';
                                    })()}
                                </p>
                                <p className="text-xs text-surface-500">
                                    专属计划，逐周发布
                                </p>
                            </div>
                        </div>
                    )}
                    
                    <div className={`grid grid-cols-7 gap-2 ${!isCurrentWeekUnlocked ? 'opacity-30 pointer-events-none' : ''}`}>
                        {weekDays.map((dayIndex) => {
                            const day = trainingDays.find(d => d.dayIndex === dayIndex);
                            const isTrainingDay = day && day.type === 'training';
                            const isRecommended = dayIndex === currentDayIndex; // 推荐的训练日（进度指针）
                            const isProgressToday = !!progressDayIndex && dayIndex === progressDayIndex; // 今日推进日
                            const isSelected = selectedDayIndex === dayIndex;
                            const isBeforeStart = dayIndex < startExecutionDay; // 在起始执行天之前
                            const isStartDay = dayIndex === startExecutionDay && startExecutionDay > 1;
                            const isCompleted = isDayCompleted(dayIndex); // 检查是否已完成
                            const exec = getExec(dayIndex);
                            const isInProgress = exec?.status === 'in_progress';
                            const isAbandoned = exec?.status === 'abandoned';

                            return (
                                <button
                                    key={dayIndex}
                                    onClick={() => setSelectedDayIndex(dayIndex)}
                                    disabled={!isCurrentWeekUnlocked}
                                    className={`
                                        relative flex flex-col items-center justify-center p-2 sm:p-3 rounded-2xl transition-all active:scale-[0.98]
                                        ${isSelected 
                                            ? 'bg-primary-500 text-surface' 
                                            : isBeforeStart
                                            ? 'bg-surface-100 opacity-50'
                                            : isCompleted
                                                ? 'bg-green-50 border border-green-100/50'
                                                : isTrainingDay
                                                    ? 'bg-surface-50 hover:bg-surface-100 border border-surface-100/50'
                                                    : 'bg-surface-50 opacity-60 hover:opacity-80 border border-surface-100/50'}
                                        ${isRecommended && !isSelected && !todayCompleted ? 'ring-2 ring-primary-500' : ''}
                                        ${isProgressToday && !isSelected ? 'ring-2 ring-surface-900' : ''}
                                        ${isStartDay && !isSelected ? 'ring-2 ring-green-500' : ''}
                                    `}
                                >
                                    {/* 推进日标记 */}
                                    {isProgressToday && (
                                        <div className="absolute -top-1 -left-1 bg-surface-900 text-surface text-[8px] px-1 rounded-full">
                                            推进
                                        </div>
                                    )}
                                    {/* 起始执行天标记 */}
                                    {isStartDay && (
                                        <div className="absolute -top-1 -right-1 bg-green-600 text-surface text-[8px] px-1 rounded-full">
                                            开始
                                        </div>
                                    )}
                                    
                                    {/* 状态标记 */}
                                    {(isBeforeStart || isCompleted) && (
                                        <div className={`absolute -top-1 -right-1 ${isCompleted ? 'bg-green-600' : 'bg-surface-400'} text-surface text-[8px] p-0.5 rounded-full`}>
                                            <Check className="w-2 h-2" />
                                        </div>
                                    )}
                                    {isInProgress && (
                                        <div className="absolute -top-1 -right-1 bg-amber-600 text-surface text-[8px] px-1 rounded-full">
                                            进行中
                                        </div>
                                    )}
                                    {isAbandoned && (
                                        <div className="absolute -top-1 -right-1 bg-surface-600 text-surface text-[8px] px-1 rounded-full">
                                            跳过
                                        </div>
                                    )}
                                    
                                    <div className={`text-xs sm:text-sm font-bold ${isSelected ? 'text-surface' : isCompleted ? 'text-green-700' : 'text-surface-900'}`}>
                                        {dayIndex}
                                    </div>
                                    <div className={`text-[9px] sm:text-[10px] mt-0.5 truncate max-w-full ${isSelected ? 'text-surface opacity-80' : isCompleted ? 'text-green-600' : 'text-surface-500'}`}>
                                        {isCompleted
                                            ? '✓'
                                            : isInProgress
                                                ? '进行中'
                                                : isAbandoned
                                                    ? '跳过'
                                                    : isTrainingDay
                                                        ? '训练'
                                                        : '休息'}
                                    </div>
                                </button>
                            );
                        })}
                        
                        {/* 填充空位 */}
                        {Array.from({ length: 7 - weekDays.length }).map((_, i) => (
                            <div key={`empty-${i}`} className="p-2 sm:p-3 rounded-2xl bg-surface-50 opacity-30 border border-surface-100/50" />
                        ))}
                    </div>
                </div>

                {/* Selected Day Preview */}
                {!isCurrentWeekUnlocked ? (
                    /* 制定中周的预览区域 */
                    <div className="text-center py-8 bg-amber-50/50 rounded-2xl border border-amber-100/50">
                        <i className="pi pi-pencil text-2xl text-amber-600 mb-3" />
                        <p className="text-amber-600 text-sm font-medium tracking-tight">本周训练内容制定中</p>
                        <p className="text-amber-600 text-xs mt-1">教练正在精心准备，敬请期待</p>
                    </div>
                ) : selectedDay ? (
                    selectedDay.type === 'training' ? (
                        <div>
                            <div className="mb-3">
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="font-bold text-surface-900 tracking-tight">
                                        第 {selectedDayIndex} 天
                                    </h4>
                                    <span className="text-xs text-surface-500 font-medium">
                                        {selectedDay.actionSets?.length || 0} 个动作
                                    </span>
                                </div>
                                {(isDayCompleted(selectedDayIndex) || getExec(selectedDayIndex)?.status === 'in_progress' || getExec(selectedDayIndex)?.status === 'abandoned' || selectedDayIndex < startExecutionDay) && (
                                    <p className="text-xs text-surface-500">
                                        {isDayCompleted(selectedDayIndex)
                                            ? `✓ 已完成${getActualDateLabel(selectedDayIndex) ? ' · ' + getActualDateLabel(selectedDayIndex) : ''}`
                                            : getExec(selectedDayIndex)?.status === 'in_progress'
                                                ? `进行中${getActualDateLabel(selectedDayIndex) ? ' · ' + getActualDateLabel(selectedDayIndex) : ''}`
                                                : getExec(selectedDayIndex)?.status === 'abandoned'
                                                    ? '已跳过'
                                                    : selectedDayIndex < startExecutionDay
                                                        ? '线下已完成'
                                                        : ''}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2 mb-3">
                                {(selectedDay.actionSets || []).map((actionSet: any, idx: number) => {
                                    // 支持两种字段名: action_id 和 actionId
                                    const actionId = actionSet.action_id || actionSet.actionId;
                                    const action = actions[actionId];
                                    const load = actionSet.params?.load;
                                    const intensity = actionSet.params?.['强度'] || actionSet.intensity;
                                    const noteText = String(actionSet?.params?.note || actionSet?.note || '').trim();
                                    
                                    return (
                                        <div key={idx} className="bg-surface-50 rounded-2xl p-2.5 sm:p-3 border border-surface-100/50 text-sm">
                                            <div className="font-medium flex items-center justify-between gap-2">
                                                <div className="min-w-0 truncate">
                                                    {idx + 1}. {action?.name || actionSet.set_name}
                                                </div>
                                                {action?.detail && (
                                                    <button
                                                        type="button"
                                                        className="p-1.5 rounded-2xl text-surface-600 hover:bg-surface transition-colors active:scale-[0.98]"
                                                        title="查看动作说明"
                                                        onClick={() => setInfoDialog({
                                                            title: action?.name || actionSet.set_name || '动作说明',
                                                            detail: String(action.detail || '').trim(),
                                                        })}
                                                    >
                                                        <Info className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="text-surface-600 flex flex-wrap gap-2">
                                                {/* 根据动作类型显示不同的摘要信息 */}
                                                {(() => {
                                                    const itemType = actionSet.itemType || action?.type || 'STRENGTH';
                                                    const params = actionSet.params || {};
                                                    const customData = params.custom_data || {};
                                                    
                                                    switch (itemType) {
                                                        case 'DIET':
                                                            return (
                                                                <span className="text-green-600">
                                                                    🥗 {customData.content || action?.detail || '饮食建议'}
                                                                </span>
                                                            );
                                                        case 'CARDIO':
                                                            return (
                                                                <span className="text-blue-600">
                                                                    🏃 {customData.duration ? `${(customData.duration / 60).toFixed(0)}分钟` : ''}
                                                                    {customData.distance ? ` · ${(customData.distance / 1000).toFixed(1)}km` : ''}
                                                                    {!customData.duration && !customData.distance && (action?.detail || '有氧运动')}
                                                                </span>
                                                            );
                                                        case 'HABIT':
                                                            return (
                                                                <span className="text-purple-600">
                                                                    ✅ {customData.habit_name || action?.detail || '习惯打卡'}
                                                                </span>
                                                            );
                                                        case 'STRENGTH':
                                                        default:
                                                            return (
                                                                <>
                                                                    <span>
                                                                        {(() => {
                                                                            const parsePositiveIntOrNull = (v: any) => {
                                                                                if (v === null || v === undefined || v === '') return null;
                                                                                const n = Number(v);
                                                                                if (!Number.isFinite(n) || n <= 0) return null;
                                                                                return Math.floor(n);
                                                                            };
                                                                            const sets = parsePositiveIntOrNull(params['组数'] ?? actionSet.sets) ?? 1;
                                                                            const reps = parsePositiveIntOrNull(params['次数'] ?? actionSet.reps);
                                                                            const durationSeconds = parsePositiveIntOrNull(params['持续时间'] ?? actionSet.durationSeconds);
                                                                            return `${sets}组 × ${
                                                                                durationSeconds !== null
                                                                                    ? `${durationSeconds}秒`
                                                                                    : (reps !== null ? `${reps}次` : '自选')
                                                                            }`;
                                                                        })()}
                                                                    </span>
                                                                    {(() => {
                                                                        if (load !== null && load !== undefined) {
                                                                            const numericLoad = Number(load);
                                                                            if (!Number.isFinite(numericLoad)) return null;

                                                                            if (numericLoad < 0) {
                                                                                return (
                                                                                    <span className="text-red-500 font-medium">
                                                                                        💪 辅助{formatKgValueForGym(Math.abs(numericLoad))}kg
                                                                                    </span>
                                                                                );
                                                                            }
                                                                            if (numericLoad > 0) {
                                                                                return (
                                                                                    <span className="text-green-600 font-medium">
                                                                                        💪 {formatKgValueForGym(numericLoad)}kg
                                                                                    </span>
                                                                                );
                                                                            }
                                                                            // numericLoad === 0 => don't show
                                                                            return null;
                                                                        }
                                                                        if (intensity) return <span>· {intensity}</span>;
                                                                        return null;
                                                                    })()}
                                                                    {(() => {
                                                                        const restSeconds =
                                                                            params['休息时间'] ??
                                                                            params['组间休息'] ??
                                                                            params.restSeconds ??
                                                                            params.rest_seconds ??
                                                                            actionSet.rest_seconds;
                                                                        const n = Number(restSeconds);
                                                                        if (!Number.isFinite(n) || n <= 0) return null;
                                                                        const minutes = Math.round((n / 60) * 10) / 10;
                                                                        const text = String(minutes).endsWith('.0')
                                                                            ? String(minutes).slice(0, -2)
                                                                            : String(minutes);
                                                                        return <span>⏱️ 休息{text}分钟</span>;
                                                                    })()}
                                                                </>
                                                            );
                                                    }
                                                })()}
                                            </div>

                                            {/* 教练备注：在浏览训练日预览中也优先展示 */}
                                            {noteText && (
                                                <div className="mt-2 flex items-start gap-2 rounded-2xl border border-amber-200/50 bg-amber-50 px-2.5 py-2 text-amber-800">
                                                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
                                                    <div className="text-xs leading-relaxed line-clamp-2">
                                                        {noteText}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Button based on whether it's recommended day and execution status */}
                            {selectedDayIndex < startExecutionDay ? (
                                <Button
                                    label="线下已完成"
                                    icon={<Check className="w-5 h-5" />}
                                    className="w-full rounded-2xl"
                                    severity="secondary"
                                    disabled
                                />
                            ) : selectedDayIndex === currentDayIndex && todayExecutionStatus === 'completed' ? (
                                <Button
                                    label="查看记录"
                                    icon={<Eye className="w-5 h-5" />}
                                    onClick={() => router.push(`/training-execution/${instance.id}?dayIndex=${selectedDayIndex}`)}
                                    className="w-full rounded-2xl transition-all active:scale-[0.98] duration-200 ease-out"
                                    severity="secondary"
                                    outlined
                                />
                            ) : selectedDayIndex === currentDayIndex && todayExecutionStatus === 'in_progress' ? (
                                <Button
                                    label="继续训练"
                                    icon={<Play className="w-5 h-5" />}
                                    onClick={() => router.push(`/training-execution/${instance.id}?dayIndex=${selectedDayIndex}`)}
                                    className="w-full rounded-2xl transition-all active:scale-[0.98] duration-200 ease-out"
                                    severity="warning"
                                />
                            ) : (
                                <Button
                                    label={selectedDayIndex === currentDayIndex ? "开始训练" : "查看训练"}
                                    icon={<Play className="w-5 h-5" />}
                                    onClick={() => router.push(`/training-execution/${instance.id}?dayIndex=${selectedDayIndex}`)}
                                    className="w-full rounded-2xl transition-all active:scale-[0.98] duration-200 ease-out"
                                    severity={selectedDayIndex === currentDayIndex ? "success" : "info"}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <div className="text-5xl mb-3">😌</div>
                            <h4 className="text-lg font-bold text-surface-900 mb-1 tracking-tight">休息日</h4>
                            <p className="text-sm text-surface-600">好好休息，为下次训练做准备</p>
                        </div>
                    )
                ) : (
                    <div className="text-center py-6 text-surface-500 text-sm">
                        请选择日期查看训练内容
                    </div>
                )}
            </div>

            <Dialog
                header={infoDialog?.title || '动作说明'}
                visible={!!infoDialog}
                onHide={() => setInfoDialog(null)}
                draggable={false}
                resizable={false}
                className="w-[min(92vw,520px)]"
            >
                <div className="text-sm text-surface-700 leading-relaxed whitespace-pre-wrap">
                    {infoDialog?.detail || ''}
                </div>
            </Dialog>
        </div>
    );
};

export default BrowseSection;
