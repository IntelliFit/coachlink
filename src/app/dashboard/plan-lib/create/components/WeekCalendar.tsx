'use client';

import React from 'react';
import { Button } from 'primereact/button';

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
    // 将天数按周分组
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
        weeks.push(days.slice(i, i + 7));
    }

    return (
        <div className="card shadow-sm h-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-900">训练日历</h3>
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
                        <div key={weekIndex} className="border-round p-3 bg-surface-50">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-medium">第 {weekNumber} 周</span>
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
                            
                            <div className="grid grid-cols-7 gap-1">
                                {week.map((day) => (
                                    <div 
                                        key={day.dayIndex} 
                                        className={`
                                            flex flex-column align-items-center justify-content-center 
                                            p-2 border-round cursor-pointer transition-all transition-duration-150
                                            ${selectedDayIndex === day.dayIndex 
                                                ? 'bg-primary text-white border-primary' 
                                                : 'bg-surface-0 hover:bg-surface-100 border-surface'}
                                            ${day.type === 'rest' ? 'line-through text-500' : ''}
                                        `}
                                        onClick={() => !saving && onSelectDay(day.dayIndex)}
                                    >
                                        <span className="text-xs opacity-80">第{day.dayIndex}天</span>
                                        <span className="text-lg font-bold">
                                            {day.type === 'training' ? '训' : '休'}
                                        </span>
                                    </div>
                                ))}
                                
                                {/* 填充空白日期 */}
                                {Array.from({ length: 7 - week.length }).map((_, index) => (
                                    <div 
                                        key={`empty-${index}`} 
                                        className="p-2 border-round border-1 border-dashed border-surface flex align-items-center justify-content-center"
                                    >
                                        <span className="text-400 text-xs">-</span>
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