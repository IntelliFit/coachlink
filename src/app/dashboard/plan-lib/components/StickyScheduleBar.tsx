'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
    Dumbbell,
    Coffee,
    Check,
    ArrowLeft,
    Plus,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { FormPlanTrainingDay } from '@/app/api/plan-lib/create-template/entity';

interface StickyScheduleBarProps {
    days: FormPlanTrainingDay[];
    selectedDayIndex: number | null;
    onSelectDay: (dayIndex: number) => void;
    onBack: () => void;
    onAddWeek?: () => void;
    saving: boolean;
    startExecutionDay?: number;
    /** 展开「全部周」时通知父级，用于加大页面顶部留白避免压住标题 */
    onExpandedChange?: (expanded: boolean) => void;
}

/**
 * 悬停在屏幕上方中央的训练日选择条
 * 默认按周分页；可上下展开查看全部周（内部滚动）
 */
const StickyScheduleBar: React.FC<StickyScheduleBarProps> = ({
    days,
    selectedDayIndex,
    onSelectDay,
    onBack,
    onAddWeek,
    saving,
    startExecutionDay,
    onExpandedChange,
}) => {
    const [expanded, setExpanded] = useState(false);

    const weeks = useMemo(() => {
        const w: FormPlanTrainingDay[][] = [];
        for (let i = 0; i < days.length; i += 7) {
            w.push(days.slice(i, i + 7));
        }
        return w;
    }, [days]);

    useEffect(() => {
        onExpandedChange?.(expanded);
    }, [expanded, onExpandedChange]);

    useEffect(() => {
        if (weeks.length <= 1) setExpanded(false);
    }, [weeks.length]);

    const selectedWeekIndex = useMemo(() => {
        if (!selectedDayIndex || selectedDayIndex < 1) return 0;
        return Math.floor((selectedDayIndex - 1) / 7);
    }, [selectedDayIndex]);

    const selectedDayOfWeekIndex = useMemo(() => {
        if (!selectedDayIndex || selectedDayIndex < 1) return 0;
        return (selectedDayIndex - 1) % 7;
    }, [selectedDayIndex]);

    const weekDays = weeks[selectedWeekIndex] ?? [];

    const goToWeek = (nextWeekIndex: number) => {
        if (weeks.length === 0) return;
        const clamped = Math.min(Math.max(nextWeekIndex, 0), weeks.length - 1);
        const targetWeek = weeks[clamped] || [];
        const targetDay = targetWeek[Math.min(selectedDayOfWeekIndex, Math.max(targetWeek.length - 1, 0))];
        if (targetDay) onSelectDay(targetDay.dayIndex);
    };

    const toggleExpanded = useCallback(() => {
        setExpanded((v) => !v);
    }, []);

    const renderDayChip = (day: FormPlanTrainingDay) => {
        const isSelected = selectedDayIndex === day.dayIndex;
        const isTraining = day.type === 'training';
        const isStarted = startExecutionDay && day.dayIndex === startExecutionDay;
        const isPassed = startExecutionDay && day.dayIndex < startExecutionDay;

        return (
            <button
                key={day.dayIndex}
                type="button"
                disabled={saving}
                onClick={() => !saving && onSelectDay(day.dayIndex)}
                className={`
                    relative shrink-0
                    w-[68px] h-[40px] sm:w-[76px] sm:h-[44px] md:w-[80px] md:h-[46px]
                    rounded-2xl border transition-all duration-200
                    flex items-center justify-between px-2
                    active:scale-[0.98]
                    touch-manipulation
                    ${isSelected
                        ? 'bg-surface border-primary-500 shadow-[0_4px_12px_rgba(59,130,246,0.2)]'
                        : 'bg-surface-50/90 border-surface-100 hover:bg-surface hover:border-surface-200'}
                    ${isPassed ? 'opacity-50 grayscale' : ''}
                `}
            >
                <div className="flex flex-col items-start leading-none">
                    <span className={`text-[11px] font-black ${isSelected ? 'text-primary-500' : 'text-surface-400'}`}>
                        第{day.dayIndex}日
                    </span>
                    <span className={`mt-0.5 text-[11px] font-black ${isSelected ? 'text-primary-700' : 'text-surface-700'}`}>
                        {isTraining ? '训练' : '休息'}
                    </span>
                </div>

                <div className={`shrink-0 ${isSelected ? 'text-primary-600' : isTraining ? 'text-surface-700' : 'text-surface-300'}`}>
                    {isTraining ? <Dumbbell size={14} strokeWidth={2.5} /> : <Coffee size={14} strokeWidth={2.5} />}
                </div>

                {isStarted && (
                    <div className="absolute -top-0.5 -right-0.5 bg-green-500 text-surface p-0.5 rounded-full min-w-[10px] min-h-[10px] flex items-center justify-center">
                        <Check size={5} strokeWidth={4} />
                    </div>
                )}
            </button>
        );
    };

    const addWeekButton = onAddWeek ? (
        <button
            type="button"
            onClick={onAddWeek}
            disabled={saving}
            className="
                shrink-0
                w-[68px] h-[40px] sm:w-[76px] sm:h-[44px] md:w-[80px] md:h-[46px]
                rounded-2xl border-2 border-dashed border-surface-200
                flex items-center justify-center
                text-surface-400 hover:text-surface-600 hover:border-surface-300
                active:scale-[0.98] transition-all
                disabled:opacity-40 disabled:cursor-not-allowed
            "
            title="添加新的一周"
        >
            <Plus size={16} strokeWidth={2.5} />
        </button>
    ) : null;

    return (
        <div
            className="
                fixed top-0 left-0 right-0 z-[60]
                pt-[max(0.75rem,env(safe-area-inset-top))] pb-2
                px-2 sm:px-6 lg:px-8
                flex justify-center
            "
        >
            <div className="w-full max-w-7xl flex items-stretch gap-3 sm:gap-4">
                {/* 返回单独在卡片外，避免与「第1日」同一容器内误触退出 */}
                <button
                    type="button"
                    onClick={onBack}
                    disabled={saving}
                    title="返回"
                    aria-label="返回"
                    className="
                        shrink-0 self-center
                        w-11 h-11 sm:w-12 sm:h-12
                        flex items-center justify-center
                        rounded-full border border-surface-200/80
                        bg-surface/95 backdrop-blur-md shadow-[0_2px_12px_rgba(0,0,0,0.06)]
                        text-surface-700 hover:bg-surface-100 hover:border-surface-300
                        active:scale-95
                        disabled:opacity-40 disabled:cursor-not-allowed
                        transition-all duration-200
                    "
                >
                    <ArrowLeft size={20} strokeWidth={2.5} />
                </button>

                <div
                    className="
                        flex-1 min-w-0 flex flex-col gap-1.5
                        px-2.5 py-1.5 sm:px-3 sm:py-2
                        bg-surface/95 backdrop-blur-md
                        border border-surface-200/50
                        rounded-[28px]
                        shadow-[0_4px_20px_rgba(0,0,0,0.08)]
                    "
                >
                    <div className="flex items-center justify-between gap-2 px-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] sm:text-[11px] font-black text-surface-500 tabular-nums shrink-0">
                                第 {weeks.length === 0 ? 0 : selectedWeekIndex + 1} / {weeks.length} 周
                            </span>
                            {weeks.length > 1 && (
                                <button
                                    type="button"
                                    onClick={toggleExpanded}
                                    className="
                                        flex items-center gap-0.5 shrink-0
                                        px-2 py-1 rounded-xl border border-surface-200 bg-surface-50/90
                                        text-[10px] sm:text-[11px] font-black text-surface-600
                                        hover:bg-surface hover:border-surface-300
                                        active:scale-[0.98] transition-all
                                    "
                                    aria-expanded={expanded}
                                    aria-label={expanded ? '收起全部周' : '展开全部周'}
                                >
                                    {expanded ? (
                                        <>
                                            收起
                                            <ChevronUp size={14} strokeWidth={2.5} className="text-surface-500" />
                                        </>
                                    ) : (
                                        <>
                                            展开
                                            <ChevronDown size={14} strokeWidth={2.5} className="text-surface-500" />
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                            <button
                                type="button"
                                disabled={saving || selectedWeekIndex <= 0}
                                onClick={() => goToWeek(selectedWeekIndex - 1)}
                                className="
                                    p-1.5 rounded-xl border border-surface-200 bg-surface
                                    text-surface-700 hover:bg-surface-100
                                    disabled:opacity-35 disabled:cursor-not-allowed
                                    active:scale-95 transition-all
                                "
                                aria-label="上一周"
                            >
                                <ChevronLeft size={16} strokeWidth={2.5} />
                            </button>
                            <button
                                type="button"
                                disabled={saving || selectedWeekIndex >= weeks.length - 1}
                                onClick={() => goToWeek(selectedWeekIndex + 1)}
                                className="
                                    p-1.5 rounded-xl border border-surface-200 bg-surface
                                    text-surface-700 hover:bg-surface-100
                                    disabled:opacity-35 disabled:cursor-not-allowed
                                    active:scale-95 transition-all
                                "
                                aria-label="下一周"
                            >
                                <ChevronRight size={16} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>

                    {!expanded && (
                        <div
                            className="
                                flex flex-nowrap justify-start gap-1.5 py-0.5
                                overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch]
                                custom-scrollbar
                            "
                        >
                            {weekDays.map((day) => renderDayChip(day))}
                            {addWeekButton}
                        </div>
                    )}

                    {expanded && weeks.length > 0 && (
                        <div
                            className="
                                max-h-[min(50vh,360px)] overflow-y-auto overflow-x-hidden
                                pr-0.5 -mr-0.5
                                flex flex-col gap-3 py-0.5
                                custom-scrollbar
                            "
                        >
                            {weeks.map((week, weekIndex) => (
                                <div key={weekIndex} className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-black text-surface-400 uppercase tracking-wider px-0.5">
                                        第 {weekIndex + 1} 周
                                    </span>
                                    <div
                                        className="
                                            flex flex-nowrap justify-start gap-1.5
                                            overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch]
                                            custom-scrollbar pb-0.5
                                        "
                                    >
                                        {week.map((day) => renderDayChip(day))}
                                        {weekIndex === weeks.length - 1 && addWeekButton}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StickyScheduleBar;
