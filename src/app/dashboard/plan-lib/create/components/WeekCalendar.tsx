'use client';

import React from 'react';
import { Button } from 'primereact/button';
import { ScrollPanel } from 'primereact/scrollpanel';

interface WeekCalendarProps {
    days: {
        dayIndex: number;
        type: 'training' | 'rest';
        note: string;
        actionSets: any[];
    }[];
    selectedDayIndex: number | null;
    onSelectDay: (dayIndex: number) => void;
    onAddWeek: () => void;
    onDeleteWeek: (weekStartIndex: number) => void;
    saving: boolean;
}

const WeekCalendar: React.FC<WeekCalendarProps> = ({
    days,
    selectedDayIndex,
    onSelectDay,
    onAddWeek,
    onDeleteWeek,
    saving
}) => {
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
        weeks.push(days.slice(i, i + 7));
    }

    return (
        <div className="h-full border-1">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-900">训练日历</h3>
                <Button
                    label="添加周"
                    icon="pi pi-plus"
                    onClick={onAddWeek}
                    disabled={saving}
                    className="p-button-sm"
                />
            </div>

            <div className="flex flex-col gap-4">
                {weeks.map((week, weekIndex) => {
                    const weekStartIndex = weekIndex * 7;
                    const weekNumber = weekIndex + 1;

                    return (
                        <div
                            key={weekIndex}
                            className="border-round p-3 border-surface-200 rounded-lg"
                        >
                            <div className="flex justify-between items-center mb-3">
                                <span className="font-medium text-800">第 {weekNumber} 周</span>
                                {weeks.length > 1 && (
                                    <Button
                                        icon="pi pi-trash"
                                        className="p-button-text p-button-danger p-button-sm"
                                        onClick={() => onDeleteWeek(weekStartIndex)}
                                        disabled={saving}
                                        tooltip="删除整周"
                                    />
                                )}
                            </div>

                            <div className="grid grid-cols-7 gap-2">
                                {week.map((day) => {
                                    const isSelected = selectedDayIndex === day.dayIndex;
                                    const isTraining = day.type === 'training';

                                    return (
                                        <div
                                            key={day.dayIndex}
                                            onClick={() => !saving && onSelectDay(day.dayIndex)}
                                            className={`
                                                cursor-pointer border-round p-3 shadow-sm 
                                                border-1 transition-all 
                                                flex flex-col items-center justify-center gap-1

                                                ${isSelected
                                                    ? 'border-primary-500 ring-2 ring-primary-200'
                                                    : 'border-surface-200 hover:bg-surface-50'}
                                            `}
                                            style={{
                                                borderLeft: `6px solid ${isTraining ? 'var(--primary-400)' : 'var(--surface-400)'
                                                    }`
                                            }}
                                        >
                                            <span className="text-xs opacity-70">
                                                第{day.dayIndex}天
                                            </span>

                                            <span className={`text-xl ${isTraining ? 'text-primary-600' : 'text-600'}`}>
                                                {isTraining ? (
                                                    <i className="pi pi-bolt"></i>
                                                ) : (
                                                    <i className="pi pi-moon"></i>
                                                )}
                                            </span>
                                        </div>
                                    );
                                })}

                                {/* 空白占位日 */}
                                {Array.from({ length: 7 - week.length }).map((_, i) => (
                                    <div
                                        key={`empty-${i}`}
                                        className="p-3 border-round border-1 border-dashed border-surface-200 
                                                   flex items-center justify-center text-400 text-xs"
                                    >
                                        -
                                    </div>
                                ))}
                            </div>

                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default WeekCalendar;
