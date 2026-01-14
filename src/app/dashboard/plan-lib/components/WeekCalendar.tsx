'use client';

import React, { useState, useRef } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { ConfirmPopup, confirmPopup } from 'primereact/confirmpopup';
import { ScrollPanel } from 'primereact/scrollpanel';
import { useToastContext } from '@/context/ToastContext';
import { FormPlanTrainingDay } from '@/app/api/plan-lib/create-template/entity';
import { Calendar, Plus, Trash2, Bolt, Moon, Check, Dumbbell, BatteryMedium, Coffee } from 'lucide-react';

interface WeekCalendarProps {
    days: FormPlanTrainingDay[];
    selectedDayIndex: number | null;
    onSelectDay: (dayIndex: number) => void;
    onAddWeek: () => void;
    onAddWeekFromExisting: (sourceWeekIndex: number) => void;
    onDeleteWeek: (weekStartIndex: number) => void;
    saving: boolean;
    /** 起始执行天数（可选，用于显示"开始"标记） */
    startExecutionDay?: number;
}

const WeekCalendar: React.FC<WeekCalendarProps> = ({
    days,
    selectedDayIndex,
    onSelectDay,
    onAddWeek,
    onAddWeekFromExisting,
    onDeleteWeek,
    saving,
    startExecutionDay
}) => {
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [pendingDeleteWeekIndex, setPendingDeleteWeekIndex] = useState<number | null>(null);
    const [selectedOption, setSelectedOption] = useState<'blank' | number | null>(null);
    const acceptBtnRef = useRef(null);
    const rejectBtnRef = useRef(null);
    const { showToast } = useToastContext();

    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
        weeks.push(days.slice(i, i + 7));
    }

    const confirmDelete = () => {
        if (pendingDeleteWeekIndex !== null) {
            onDeleteWeek(pendingDeleteWeekIndex);
        }
        setDeleteConfirmVisible(false);
        setPendingDeleteWeekIndex(null);
    };

    const handleAccept = () => {
        if (selectedOption === 'blank') {
            onAddWeek();
        } else if (typeof selectedOption === 'number') {
            onAddWeekFromExisting(selectedOption);
        }
    };

    const handleReject = () => {
        // 取消操作，重置选中状态
        setSelectedOption(null);
    };

    const showAddWeekPopup = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (weeks.length > 0) {
            // 重置选中选项
            setSelectedOption(null);

            confirmPopup({
                target: event.currentTarget,
                message: (
                    <div className="p-3 min-w-48">
                        <div className="flex flex-col gap-2">
                            <Button
                                label="新建空白周"
                                className={`w-full text-left justify-start option-btn ${selectedOption === 'blank' ? 'selected' : ''}`}
                                onClick={() => setSelectedOption('blank')}
                                disabled={saving}
                            />

                            {weeks.map((week, weekIndex) => {
                                const weekNumber = weekIndex + 1;
                                return (
                                    <Button
                                        key={weekIndex}
                                        label={`第 ${weekNumber} 周`}
                                        className={`w-full text-left justify-start option-btn ${selectedOption === weekIndex ? 'selected' : ''}`}
                                        onClick={() => setSelectedOption(weekIndex)}
                                        disabled={saving}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ),
                visible: true,
                accept: () => {
                    showToast({ severity: 'success', summary: '添加成功' })
                },
                reject: () => { },
                acceptLabel: '添加',
                rejectLabel: '取消',
                dismissable: true,
                onHide: () => {
                    // popup 隐藏时重置选中选项
                    setSelectedOption(null);
                }
            });
        } else {
            // 如果还没有周，直接添加空白周
            onAddWeek();
        }
    };

    return (
        <div className="flex flex-col gap-6">
            {/* 头部：数值中心化与简洁操作 */}
            <div className="flex justify-between items-end px-1">
                <div className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-2xl font-black text-surface-900 tracking-tighter">训练计划排期</h3>
                        <span className="text-xs font-bold text-surface-400">共 {weeks.length} 周</span>
                    </div>
                </div>

                <button
                    onClick={onAddWeek}
                    disabled={saving}
                    className="
                        flex items-center gap-2 px-4 py-2 
                        bg-surface border border-surface-200 rounded-[14px]
                        
                        text-[12px] font-black text-surface-700 tracking-tight
                        
                        transition-all duration-200 active:scale-[0.95]
                        hover:border-primary-300 hover:text-primary-600 hover:shadow-sm
                        disabled:opacity-40 disabled:cursor-not-allowed
                    "
                >
                    <Plus size={14} strokeWidth={3} />
                    添加新的一周
                </button>
            </div>

            {weeks.length === 0 ? (
                /* 空状态：骨架感占位 */
                <div className="flex flex-col items-center justify-center min-h-[320px] bg-surface-50/50 rounded-[24px] border border-dashed border-surface-200">
                    <Calendar size={48} className="text-surface-200 mb-4" />
                    <p className="text-[13px] font-bold text-surface-400 tracking-tight">暂无排期，点击上方按钮开始编排</p>
                </div>
            ) : (
                <ScrollPanel className="flex-grow" style={{ height: 'calc(100vh - 200px)' }}>
                    <div className="flex flex-col gap-8 p-2">
                        {weeks.map((week, weekIndex) => (
                            <div key={weekIndex} className="group flex flex-col gap-4">
                                {/* 周标题与删除操作：非对称过渡 */}
                                <div className="flex justify-between items-center px-2">
                                    <span className="text-[11px] font-black text-surface-400 uppercase tracking-[0.15em]">
                                        第 {weekIndex + 1} 周
                                    </span>
                                    {weeks.length > 1 && (
                                        <button
                                            onClick={() => {
                                                setPendingDeleteWeekIndex(weekIndex * 7);
                                                setDeleteConfirmVisible(true);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-2 text-surface-400 hover:text-red-500 transition-all active:scale-[0.9]"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>

                                {/* 日历网格：数值中心化 + 物理缩放 */}
                                <div className="grid grid-cols-7 gap-3">
                                    {week.map((day) => {
                                        const isSelected = selectedDayIndex === day.dayIndex;
                                        const isTraining = day.type === 'training';
                                        const isStarted = startExecutionDay && day.dayIndex === startExecutionDay;
                                        const isPassed = startExecutionDay && day.dayIndex < startExecutionDay;

                                        return (
                                            <div
                                                key={day.dayIndex}
                                                onClick={() => !saving && onSelectDay(day.dayIndex)}
                                                className={`
                                                    relative h-24 cursor-pointer rounded-[20px] transition-all duration-300
                                                    flex flex-col items-center justify-center gap-2
                                                    active:scale-[0.92] select-none
                                                    ${isSelected
                                                        ? 'bg-surface border-[2px] border-primary-500 shadow-[0_8px_20px_rgba(59,130,246,0.15)] z-10'
                                                        : 'bg-surface-50/80 border-transparent hover:bg-surface hover:border-surface-200'
                                                    }
                                                    ${isStarted ? 'ring-2 ring-green-500 ring-offset-2' : ''}
                                                    ${isPassed ? 'opacity-40 filter grayscale' : ''}
                                                `}
                                            >
                                                <span className={`text-[10px] font-black tracking-tighter ${isSelected ? 'text-primary-500' : 'text-surface-400'}`}>
                                                    第 {day.dayIndex} 日
                                                </span>

                                                <div className={`${isSelected ? 'text-primary-600' : isTraining ? 'text-surface-700' : 'text-surface-300'}`}>
                                                    {isTraining ? <Dumbbell size={20} strokeWidth={2.5} /> : <Coffee size={20} strokeWidth={2.5} />}
                                                </div>

                                                <span className={`text-[10px] font-bold ${isSelected ? 'text-primary-400' : 'text-surface-400'}`}>
                                                    {isTraining ? '训练' : '休息'}
                                                </span>

                                                {/* 状态徽章：轻盈色阶 */}
                                                {isStarted && (
                                                    <div className="absolute -top-1.5 -right-1.5 bg-green-500 text-surface p-1 rounded-full shadow-lg">
                                                        <Check size={8} strokeWidth={4} />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* 补白格：保持结构对齐 */}
                                    {Array.from({ length: 7 - week.length }).map((_, i) => (
                                        <div key={i} className="h-24 rounded-[20px] border border-dashed border-surface-100 bg-surface-50/20" />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollPanel>
            )}

            {/* 精简版删除弹窗 */}
            <Dialog
                visible={deleteConfirmVisible}
                onHide={() => setDeleteConfirmVisible(false)}
                closable={false}
                showHeader={false}
                style={{ width: '280px' }}
                contentClassName="p-6 rounded-[24px]"
            >
                <div className="text-center space-y-4">
                    <p className="text-sm font-bold text-surface-900 tracking-tight">确定删除整周排期吗？</p>
                    <div className="flex gap-2">
                        <button onClick={() => setDeleteConfirmVisible(false)} className="flex-1 py-2 text-xs font-black text-surface-400 hover:text-surface-600 transition-colors">取消</button>
                        <button
                            onClick={() => {
                                if (pendingDeleteWeekIndex !== null) onDeleteWeek(pendingDeleteWeekIndex);
                                setDeleteConfirmVisible(false);
                            }}
                            className="flex-1 py-2 bg-red-50 text-red-600 rounded-[12px] text-xs font-black hover:bg-red-100 transition-colors"
                        >
                            确认删除
                        </button>
                    </div>
                </div>
            </Dialog>
        </div>
    );
};

export default WeekCalendar;