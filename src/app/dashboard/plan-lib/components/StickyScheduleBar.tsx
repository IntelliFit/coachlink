'use client';

import React from 'react';
import { Dumbbell, Coffee, Check, ArrowLeft, Plus } from 'lucide-react';
import { FormPlanTrainingDay } from '@/app/api/plan-lib/create-template/entity';

interface StickyScheduleBarProps {
    days: FormPlanTrainingDay[];
    selectedDayIndex: number | null;
    onSelectDay: (dayIndex: number) => void;
    onBack: () => void;
    onAddWeek?: () => void;
    saving: boolean;
    startExecutionDay?: number;
}

/**
 * 悬停在屏幕上方中央的训练日选择条
 * 左侧返回按钮，横向滑动查看各训练日，点击查看内容
 * 增加 padding 不撑满屏幕，移动端适配
 */
const StickyScheduleBar: React.FC<StickyScheduleBarProps> = ({
    days,
    selectedDayIndex,
    onSelectDay,
    onBack,
    onAddWeek,
    saving,
    startExecutionDay
}) => {
    return (
        <div
            className="
                fixed top-0 left-0 right-0 z-[60]
                pt-[max(0.75rem,env(safe-area-inset-top))] pb-2
                px-2 sm:px-6 lg:px-8
                flex justify-center
            "
        >
            {/* 宽度与下方模板定义、每日定义一致（max-w-7xl mx-auto） */}
            <div
                className="
                    w-full max-w-7xl
                    flex items-center gap-2
                    px-2.5 py-1.5 sm:px-3 sm:py-2
                    bg-surface/95 backdrop-blur-md
                    border border-surface-200/50
                    rounded-[28px]
                    shadow-[0_4px_20px_rgba(0,0,0,0.08)]
                "
            >
                {/* 左侧返回按钮 */}
                <button
                    type="button"
                    onClick={onBack}
                    disabled={saving}
                    className="
                        shrink-0 w-8 h-8 sm:w-9 sm:h-9
                        flex items-center justify-center
                        rounded-2xl border border-surface-200
                        bg-surface hover:bg-surface-100
                        text-surface-700 active:scale-95
                        disabled:opacity-40 disabled:cursor-not-allowed
                        transition-all duration-200
                    "
                >
                    <ArrowLeft size={18} strokeWidth={2.5} />
                </button>

                {/* 训练日横向滚动列表 */}
                <div
                    className="
                        flex-1 min-w-0
                        flex gap-1.5 overflow-x-auto
                        [-webkit-overflow-scrolling:touch] custom-scrollbar
                        py-0.5 px-0.5
                    "
                >
                {days.map((day) => {
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
                })}

                    {/* 右侧：添加新的一周 */}
                    {onAddWeek && (
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
                        >
                            <Plus size={16} strokeWidth={2.5} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StickyScheduleBar;
