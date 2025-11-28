import React from 'react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface WeekCalendarProps {
    selectedDate: Date;
    onChange: (date: Date) => void;
}

const WeekCalendar: React.FC<WeekCalendarProps> = ({ selectedDate, onChange }) => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // 周一开始
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const today = new Date();

    return (
        <div className="flex justify-between mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
            {weekDays.map((day, index) => {
                const isSelected = isSameDay(day, selectedDate);
                const isToday = isSameDay(day, today);
                
                return (
                    <button
                        key={index}
                        onClick={() => onChange(day)}
                        className={`
                            flex flex-col items-center justify-center p-3 rounded-lg cursor-pointer
                            transition-all duration-200 min-w-[60px]
                            ${isSelected 
                                ? 'bg-primary-500 text-white shadow-md scale-105' 
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                            }
                            ${isToday && !isSelected 
                                ? 'border-2 border-primary-500' 
                                : ''
                            }
                        `}
                    >
                        <div className={`text-xs opacity-70 mb-1 ${isSelected ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                            {format(day, 'EEE', { locale: zhCN })}
                        </div>
                        <div className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                            {format(day, 'd')}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

export default WeekCalendar;
