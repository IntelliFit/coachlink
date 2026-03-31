'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { ChevronLeft, ChevronRight, Check, CalendarDays } from 'lucide-react';
import { calculateCurrentWeek, formatUnlockDate, getDayWeekNumber, getUnlockDate, isDayUnlocked } from '@/lib/weekUnlock';
import {
    formatBeijingDate,
    getBeijingDateFromParts,
    getBeijingDateParts,
    getBeijingMonthDays,
    getBeijingWeekday,
    shiftBeijingMonth,
} from '@/lib/beijingTime';
import {
    formatPlanDayLabel,
    resolvePlanDayDate,
    toDateKey,
    type PlanScheduleModel,
} from './lib/dayModules';

interface BrowseSectionProps {
    instance: any;
    currentDayIndex: number;
    selectedDayIndex: number;
    onSelectedDayChange: (dayIndex: number) => void;
    executionsByDayIndex?: Record<number, any>;
    scheduleModel: PlanScheduleModel;
    todayCompleted?: boolean;
    progressDayIndex?: number;
    effectiveStartDate?: string | Date | null;
}

const weekDayLabels = ['一', '二', '三', '四', '五', '六', '日'];

const BrowseSection: React.FC<BrowseSectionProps> = ({
    instance,
    currentDayIndex,
    selectedDayIndex,
    onSelectedDayChange,
    executionsByDayIndex = {},
    scheduleModel,
    todayCompleted = false,
    progressDayIndex,
    effectiveStartDate,
}) => {
    const trainingDays = (instance?.training_days || []) as any[];
    const startExecutionDay = instance?.start_execution_day || 1;
    const totalWeeks = Math.max(1, Math.ceil(trainingDays.length / 7));
    const [isMonthExpanded, setIsMonthExpanded] = useState(false);
    const [currentWeek, setCurrentWeek] = useState(() => {
        const anchorDay = selectedDayIndex || currentDayIndex || 1;
        return Math.max(1, Math.min(Math.ceil(anchorDay / 7), totalWeeks));
    });

    const unlockedWeek = useMemo(() => {
        const startDate = effectiveStartDate || instance?.start_date;
        const byDate = calculateCurrentWeek(startDate);
        const byStartExecution = getDayWeekNumber(startExecutionDay || 1);
        return Math.max(byDate, byStartExecution);
    }, [effectiveStartDate, instance?.start_date, startExecutionDay]);

    useEffect(() => {
        const targetWeek = Math.max(1, Math.min(Math.ceil((selectedDayIndex || 1) / 7), totalWeeks));
        setCurrentWeek(targetWeek);
    }, [selectedDayIndex, totalWeeks, instance?.id]);

    const weekDays = useMemo(() => {
        const startDay = (currentWeek - 1) * 7 + 1;
        const endDay = currentWeek * 7;
        return Array.from({ length: 7 }, (_, i) => startDay + i).filter((dayIndex) => dayIndex <= trainingDays.length);
    }, [currentWeek, trainingDays.length]);

    const dayDateEntries = useMemo(() => {
        return trainingDays.map((day: any) => {
            const scheduleInfo = scheduleModel.scheduleByDayIndex.get(day.dayIndex);
            const date = scheduleInfo?.displayDate || resolvePlanDayDate({
                dayIndex: day.dayIndex,
                effectiveStartDate,
                fallbackAnchorDayIndex: progressDayIndex || currentDayIndex || 1,
            });
            return {
                dayIndex: day.dayIndex,
                type: day.type,
                date,
                key: toDateKey(date),
            };
        });
    }, [trainingDays, scheduleModel, effectiveStartDate, progressDayIndex, currentDayIndex]);

    const selectedSchedule = useMemo(() => {
        return scheduleModel.scheduleByDayIndex.get(selectedDayIndex || 1);
    }, [scheduleModel, selectedDayIndex]);

    const selectedDate = useMemo(() => {
        return selectedSchedule?.displayDate || resolvePlanDayDate({
            dayIndex: selectedDayIndex || 1,
            effectiveStartDate,
            fallbackAnchorDayIndex: progressDayIndex || currentDayIndex || 1,
        });
    }, [selectedSchedule, selectedDayIndex, effectiveStartDate, progressDayIndex, currentDayIndex]);

    const [monthCursor, setMonthCursor] = useState(() => {
        const parts = getBeijingDateParts(selectedDate);
        return { year: parts.year, month: parts.month };
    });

    useEffect(() => {
        const parts = getBeijingDateParts(selectedDate);
        setMonthCursor({ year: parts.year, month: parts.month });
    }, [selectedDate]);

    const dayIndexByDateKey = useMemo(() => {
        const map = new Map<string, number>();
        dayDateEntries.forEach((entry) => {
            map.set(entry.key, entry.dayIndex);
        });
        return map;
    }, [dayDateEntries]);

    const monthGrid = useMemo(() => {
        const leadingBlankCount = (getBeijingWeekday(monthCursor.year, monthCursor.month, 1) + 6) % 7;
        const totalDays = getBeijingMonthDays(monthCursor.year, monthCursor.month);
        const cells: Array<Date | null> = Array.from({ length: leadingBlankCount }, () => null);
        for (let day = 1; day <= totalDays; day += 1) {
            cells.push(getBeijingDateFromParts(monthCursor.year, monthCursor.month, day));
        }
        while (cells.length % 7 !== 0) {
            cells.push(null);
        }
        return cells;
    }, [monthCursor]);

    const getExec = (dayIndex: number) => executionsByDayIndex?.[dayIndex];
    const getDayStatus = (dayIndex: number) => {
        const exec = getExec(dayIndex);
        if (exec?.status === 'completed') return 'completed';
        if (exec?.status === 'in_progress') return 'in_progress';
        if (exec?.status === 'abandoned') return 'abandoned';
        if (dayIndex < startExecutionDay) return 'before_start';
        return 'pending';
    };

    const selectDay = (dayIndex: number) => {
        if (!isDayUnlocked(dayIndex, unlockedWeek)) return;
        onSelectedDayChange(dayIndex);
    };

    const renderDayBadge = (dayIndex: number) => {
        const status = getDayStatus(dayIndex);
        if (status === 'completed' || status === 'before_start') {
            return <Check className="w-3 h-3" />;
        }
        if (status === 'in_progress') return <span className="text-[8px]">进行中</span>;
        if (status === 'abandoned') return <span className="text-[8px]">跳过</span>;
        return null;
    };

    return (
        <div className="bg-surface border rounded-3xl border-surface-100/60 p-4 sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-sm text-surface-500">
                        <CalendarDays className="w-4 h-4" />
                        <span>按日期查看每日安排</span>
                    </div>
                    <h3 className="mt-2 text-xl sm:text-2xl font-black text-surface-900 tracking-tight">
                        安排日历
                    </h3>
                    <p className="mt-2 text-sm text-surface-600">
                        已选第{selectedDayIndex}天 · {formatPlanDayLabel(selectedDate)}
                        {selectedSchedule?.totalDelayDays ? ` · 已顺延 ${selectedSchedule.totalDelayDays} 天` : ''}
                        {selectedDayIndex === progressDayIndex ? ' · 今日推进' : ''}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        icon={<ChevronLeft className="w-4 h-4" />}
                        onClick={() => setCurrentWeek((prev) => Math.max(1, prev - 1))}
                        disabled={currentWeek === 1}
                        className="p-button-text p-button-sm"
                    />
                    <span className="text-sm font-semibold text-surface-600 min-w-[72px] text-center">
                        第 {currentWeek} 周
                    </span>
                    <Button
                        icon={<ChevronRight className="w-4 h-4" />}
                        onClick={() => setCurrentWeek((prev) => Math.min(totalWeeks, prev + 1))}
                        disabled={currentWeek === totalWeeks}
                        className="p-button-text p-button-sm"
                    />
                    <Button
                        label={isMonthExpanded ? '收起月历' : '展开月历'}
                        severity="secondary"
                        outlined
                        onClick={() => setIsMonthExpanded((prev) => !prev)}
                        className="rounded-2xl"
                    />
                </div>
            </div>

            <div className="mt-4 rounded-3xl border border-surface-100/70 bg-surface-50 p-3 sm:p-4">
                <div className="grid grid-cols-7 gap-2">
                    {weekDays.map((dayIndex) => {
                        const day = trainingDays.find((entry: any) => entry.dayIndex === dayIndex);
                        const scheduleInfo = scheduleModel.scheduleByDayIndex.get(dayIndex);
                        const status = getDayStatus(dayIndex);
                        const isSelected = selectedDayIndex === dayIndex;
                        const isProgressToday = dayIndex === progressDayIndex;
                        const isRecommended = dayIndex === currentDayIndex;
                        const isStartDay = dayIndex === startExecutionDay && startExecutionDay > 1;
                        const dayUnlocked = isDayUnlocked(dayIndex, unlockedWeek);

                        return (
                            <button
                                key={dayIndex}
                                type="button"
                                onClick={() => selectDay(dayIndex)}
                                disabled={!dayUnlocked}
                                className={`relative rounded-2xl border px-2 py-3 text-center transition-all active:scale-[0.98] ${
                                    isSelected
                                        ? 'border-primary-500 bg-primary-500 text-surface'
                                        : status === 'completed'
                                            ? 'border-green-200 bg-green-50 text-green-700'
                                            : status === 'in_progress'
                                                ? 'border-amber-200 bg-amber-50 text-amber-800'
                                                : status === 'abandoned'
                                                    ? 'border-surface-200 bg-surface-100 text-surface-600'
                                                    : day?.type === 'rest'
                                                        ? 'border-surface-100 bg-white text-surface-500'
                                                        : 'border-surface-100 bg-white text-surface-900 hover:bg-surface-50'
                                } ${!dayUnlocked ? 'opacity-40 cursor-not-allowed' : ''} ${
                                    isRecommended && !isSelected && !todayCompleted ? 'ring-2 ring-primary-300' : ''
                                } ${isProgressToday && !isSelected ? 'ring-2 ring-surface-900/80' : ''}`}
                            >
                                {isProgressToday && (
                                    <div className="absolute -top-1 -left-1 rounded-full bg-surface-900 px-1.5 py-0.5 text-[8px] text-surface">
                                        推进
                                    </div>
                                )}
                                {isStartDay && (
                                    <div className="absolute -top-1 -right-1 rounded-full bg-green-600 px-1.5 py-0.5 text-[8px] text-surface">
                                        开始
                                    </div>
                                )}
                                {isProgressToday && (scheduleInfo?.totalDelayDays ?? 0) > 0 && (
                                    <div className="absolute -top-1 -right-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[8px] text-surface">
                                        +{scheduleInfo?.totalDelayDays}天
                                    </div>
                                )}
                                {renderDayBadge(dayIndex) && (
                                    <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-0.5 text-[8px] ${
                                        isSelected ? 'bg-white/20 text-surface' : 'bg-surface-900 text-surface'
                                    }`}>
                                        {renderDayBadge(dayIndex)}
                                    </div>
                                )}
                                <div className="text-xs opacity-70">DAY</div>
                                <div className="mt-1 text-lg font-black">{dayIndex}</div>
                                <div className="mt-1 text-[10px] opacity-80">
                                    {day?.type === 'rest' ? '恢复' : '训练'}
                                </div>
                            </button>
                        );
                    })}
                    {Array.from({ length: 7 - weekDays.length }).map((_, index) => (
                        <div
                            key={`empty-${index}`}
                            className="rounded-2xl border border-surface-100/50 bg-white/50"
                        />
                    ))}
                </div>
            </div>

            {isMonthExpanded && (
                <div className="mt-4 rounded-3xl border border-surface-100/70 bg-white p-4">
                    <div className="mb-4 flex items-center justify-between">
                        <Button
                            icon={<ChevronLeft className="w-4 h-4" />}
                            className="p-button-text p-button-sm"
                            onClick={() => setMonthCursor((prev) => shiftBeijingMonth(prev.year, prev.month, -1))}
                        />
                        <div className="text-sm font-bold text-surface-700">
                            {formatBeijingDate(
                                getBeijingDateFromParts(monthCursor.year, monthCursor.month, 1),
                                'zh-CN',
                                { year: 'numeric', month: 'long' },
                            )}
                        </div>
                        <Button
                            icon={<ChevronRight className="w-4 h-4" />}
                            className="p-button-text p-button-sm"
                            onClick={() => setMonthCursor((prev) => shiftBeijingMonth(prev.year, prev.month, 1))}
                        />
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                        {weekDayLabels.map((label) => (
                            <div key={label} className="text-center text-xs font-bold text-surface-400">
                                {label}
                            </div>
                        ))}
                        {monthGrid.map((dateCell, index) => {
                            if (!dateCell) {
                                return <div key={`blank-${index}`} className="h-12 rounded-2xl bg-surface-50/60" />;
                            }

                            const mappedDayIndex = dayIndexByDateKey.get(toDateKey(dateCell));
                            const postponedMarker = scheduleModel.postponedByDateKey.get(toDateKey(dateCell));
                            const dayUnlocked = mappedDayIndex ? isDayUnlocked(mappedDayIndex, unlockedWeek) : false;
                            const isSelected = mappedDayIndex === selectedDayIndex;
                            const status = mappedDayIndex ? getDayStatus(mappedDayIndex) : 'calendar_only';

                            return (
                                <button
                                    key={toDateKey(dateCell)}
                                    type="button"
                                    onClick={() => mappedDayIndex && selectDay(mappedDayIndex)}
                                    disabled={!mappedDayIndex || !dayUnlocked}
                                    className={`h-14 rounded-2xl border text-sm transition-all active:scale-[0.98] ${
                                        isSelected
                                            ? 'border-primary-500 bg-primary-500 text-surface'
                                            : postponedMarker
                                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                            : !mappedDayIndex
                                                ? 'border-surface-100 bg-surface-50 text-surface-300'
                                                : status === 'completed'
                                                    ? 'border-green-200 bg-green-50 text-green-700'
                                                    : status === 'in_progress'
                                                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                                                        : status === 'abandoned'
                                                            ? 'border-surface-200 bg-surface-100 text-surface-500'
                                                            : 'border-surface-100 bg-white text-surface-700 hover:bg-surface-50'
                                    } ${mappedDayIndex && !dayUnlocked ? 'opacity-40 cursor-not-allowed' : ''}`}
                                >
                                    <div className="flex h-full flex-col items-center justify-center">
                                        <div className="font-bold">{getBeijingDateParts(dateCell).day}</div>
                                        <div className="text-[10px] opacity-80">
                                            {mappedDayIndex ? `D${mappedDayIndex}` : postponedMarker ? '顺延' : ''}
                                        </div>
                                        {!mappedDayIndex && postponedMarker && (
                                            <div className="text-[9px] opacity-70">→ D{postponedMarker.targetDayIndex}</div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-surface-100/60 bg-surface-50 px-4 py-3 text-xs text-surface-600">
                <span>点日期查看当天的力量训练、饮食、有氧和习惯模块。</span>
                {scheduleModel.postponedDates.length > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">
                        浅橙色日期 = 顺延出来的额外休息日
                    </span>
                )}
                {currentWeek > unlockedWeek && (
                    <span className="text-amber-600">
                        第 {currentWeek} 周预计 {formatUnlockDate(getUnlockDate(currentWeek, effectiveStartDate || instance?.start_date))} 解锁
                    </span>
                )}
                <span className="text-surface-400">未来周仍保留逐周发布逻辑。</span>
            </div>
        </div>
    );
};

export default BrowseSection;
