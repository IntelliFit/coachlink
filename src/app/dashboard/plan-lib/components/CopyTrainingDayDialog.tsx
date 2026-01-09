'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { CoachActionRow } from '@/types';
import { ArrowRight, Calendar, Copy, Dumbbell, Coffee, Check } from 'lucide-react';
import { FormPlanTrainingDay } from '@/app/api/plan-lib/create-template/entity';

interface CopyTrainingDayDialogProps {
    visible: boolean;
    onHide: () => void;
    trainingDays: FormPlanTrainingDay[];
    onSelectDay: (dayIndex: number) => void;
    saving: boolean;
    actions: CoachActionRow[];
    targetDayIndex: number;
}

const CopyTrainingDayDialog: React.FC<CopyTrainingDayDialogProps> = ({
    visible,
    onHide,
    trainingDays,
    onSelectDay,
    saving,
    actions,
    targetDayIndex
}) => {
    const [selectedSourceDay, setSelectedSourceDay] = useState<FormPlanTrainingDay | null>(null);

    const getWeekAndDay = (dayIndex: number) => {
        const week = Math.floor(dayIndex / 7) + 1;
        const day = (dayIndex % 7) + 1;
        return { week, day };
    };

    const groupDaysByWeek = () => {
        const weeks: { [key: number]: FormPlanTrainingDay[] } = {};
        trainingDays.forEach(day => {
            const { week } = getWeekAndDay(day.dayIndex - 1);
            if (!weeks[week]) weeks[week] = [];
            weeks[week].push(day);
        });
        return weeks;
    };

    const handleSelectDay = (day: FormPlanTrainingDay) => {
        if (saving || day.dayIndex === targetDayIndex + 1) return;
        setSelectedSourceDay(day);
    };

    const getActionName = (actionId: string) => {
        return actions.find(a => a.id === actionId)?.name || '未知动作';
    };

    const getUnit = (attr: string) => {
        const units: Record<string, string> = { '组数': '组', '次数': '次', '强度': 'RM', '休息时间': 'min', '持续时间': 's' };
        return units[attr] || '';
    };

const renderHeader = () => {
        const target = getWeekAndDay(targetDayIndex);
        
        // 计算选中的来源日信息
        const sourceInfo = selectedSourceDay 
            ? getWeekAndDay(selectedSourceDay.dayIndex - 1) 
            : null;

        return (
            <div className="flex items-center gap-3">
                <Calendar size={20} className="text-primary-500" />
                <div className="text-base font-black tracking-tighter text-surface-900 flex items-center gap-2">
                    {sourceInfo ? (
                        <>
                            <span className="text-primary-600 bg-primary-50 px-2 py-0.5 rounded-lg">
                                W{sourceInfo.week}D{sourceInfo.day}
                            </span>
                        </>
                    ) : (
                        <span>选择来源日</span>
                    )}
                    
                    <span className="text-surface-300 font-normal mx-1 flex items-center">
                        <ArrowRight size={14} className="mt-0.5" />
                    </span>
                    
                    <span className="text-surface-500">
                        复制到 <span className="text-surface-900">W{target.week}D{target.day}</span>
                    </span>
                </div>
            </div>
        );
    };

    return (
        <Dialog
            header={renderHeader()}
            visible={visible}
            onHide={() => { onHide(); setSelectedSourceDay(null); }}
            style={{ width: '90vw', maxWidth: '1100px' }}
            modal
            className="aero-dialog"
            contentClassName="p-0 border-t border-surface-100"
            footer={(
                <div className="bg-surface flex justify-end gap-3">
                    <button
                        onClick={() => { onHide(); setSelectedSourceDay(null); }}
                        className="px-6 py-2.5 text-xs font-black text-surface-400 hover:text-surface-900 transition-colors"
                        disabled={saving}
                    >
                        取消操作
                    </button>
                    <button
                        onClick={() => selectedSourceDay && onSelectDay(selectedSourceDay.dayIndex)}
                        disabled={saving || !selectedSourceDay}
                        className="
                        flex items-center gap-2 px-8 py-2.5 bg-primary-600 text-surface rounded-[16px] 
                        text-xs font-black shadow-lg shadow-primary-200 transition-all 
                        hover:bg-primary-700 active:scale-[0.95] disabled:opacity-40 disabled:grayscale
                    "
                    >
                        <Copy size={14} strokeWidth={3} />
                        确认复制内容
                    </button>
                </div>
            )}
        >
            <div className="flex flex-col md:flex-row h-[75vh] max-h-[700px] overflow-hidden">
                {/* 左侧：同步 WeekCalendar 样式的日历网格 - 优化：增加 flex-1 确保空间充足 */}
                <div className="flex-1 overflow-y-auto p-6 bg-surface border-r border-surface-100">
                    {/* 优化：移除 w-[fit-content]，允许网格自适应容器宽度 */}
                    <div className="flex flex-col gap-10">
                        {Object.entries(groupDaysByWeek()).map(([weekNum, weekDays]) => {
                            const dayMap = Object.fromEntries(weekDays.map(d => [(d.dayIndex - 1) % 7 + 1, d]));

                            return (
                                <div key={weekNum} className="flex flex-col gap-4">
                                    <span className="text-[11px] font-black text-surface-400 uppercase tracking-[0.2em] px-1">
                                        第 {weekNum} 周
                                    </span>

                                    {/* 优化：确保 grid 能够填满左侧可用空间，不再受内容挤压 */}
                                    <div className="grid grid-cols-7 gap-3 mr-2">
                                        {Array.from({ length: 7 }, (_, i) => {
                                            const day = dayMap[i + 1];
                                            if (!day) return <div key={i} className="h-24 rounded-[20px] border border-dashed border-surface-100 bg-surface-50/20" />;

                                            const isTarget = day.dayIndex === targetDayIndex + 1;
                                            const isSelected = selectedSourceDay?.dayIndex === day.dayIndex;
                                            const isTraining = day.type === 'training';

                                            return (
                                                <div
                                                    key={day.dayIndex}
                                                    onClick={() => handleSelectDay(day)}
                                                    className={`
                                                        relative h-24 cursor-pointer rounded-[20px] transition-all duration-300
                                                        flex flex-col items-center justify-center gap-2
                                                        active:scale-[0.92] select-none border
                                                        ${isTarget ? 'opacity-30 grayscale cursor-not-allowed bg-surface-100 border-transparent' : ''}
                                                        ${isSelected
                                                            ? 'bg-surface border-primary-500 border-[2px] shadow-[0_8px_20px_rgba(59,130,246,0.15)] z-10 scale-[1.05]'
                                                            : !isTarget ? 'bg-surface-50/80 border-transparent hover:bg-surface hover:border-surface-200' : ''
                                                        }
                                                    `}
                                                >
                                                    <span className={`text-[10px] font-black tracking-tighter ${isSelected ? 'text-primary-500' : 'text-surface-400'}`}>
                                                        第 {day.dayIndex} 日
                                                    </span>

                                                    <div className={`${isSelected ? 'text-primary-600' : isTraining ? 'text-surface-700' : 'text-surface-300'}`}>
                                                        {isTraining ? <Dumbbell size={18} strokeWidth={2.5} /> : <Coffee size={18} strokeWidth={2.5} />}
                                                    </div>

                                                    <span className={`text-[10px] font-bold ${isSelected ? 'text-primary-400' : 'text-surface-400'}`}>
                                                        {isTraining ? '训练' : '休息'}
                                                    </span>

                                                    {isSelected && (
                                                        <div className="absolute -top-1.5 -right-1.5 bg-primary-500 text-surface p-1 rounded-full shadow-lg">
                                                            <Check size={8} strokeWidth={4} />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 右侧：预览视图 (保持简洁质感) - 优化：固定 md 宽度，确保左侧网格不被压缩 */}
                <div className="w-full md:w-[380px] lg:w-[420px] overflow-y-auto bg-surface-50/30 p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-6 px-1">
                        <h4 className="text-[11px] font-black text-surface-400 uppercase tracking-widest">内容预览</h4>
                        {selectedSourceDay && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${selectedSourceDay.type === 'training' ? 'bg-primary-50 text-primary-600 border border-primary-100' : 'bg-surface-200 text-surface-600'}`}>
                                {selectedSourceDay.type === 'training' ? '训练模式' : '休息模式'}
                            </span>
                        )}
                    </div>

                    {selectedSourceDay ? (
                        <div className="flex-1 space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
                            {selectedSourceDay.type === 'training' && selectedSourceDay.actionSets?.length ? (
                                selectedSourceDay.actionSets.map((set, idx) => (
                                    <div key={idx} className="p-4 bg-surface rounded-[20px] border border-surface-100 shadow-sm transition-all hover:shadow-md">
                                        <div className="text-[14px] font-black text-surface-900 mb-3 tracking-tight">
                                            {getActionName(set.actionId.toString())}
                                        </div>
                                        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                                            {actions.find(a => a.id === set.actionId)?.attrs.map(attr => (
                                                <div key={attr} className="flex flex-col gap-0.5 border-l-2 border-surface-50 pl-2">
                                                    <span className="text-[9px] font-bold text-surface-400 uppercase tracking-tighter">{attr}</span>
                                                    <span className="text-[12px] font-black text-surface-700">
                                                        {attr === '休息时间' ? ((set.params[attr] || 0) / 60).toFixed(1) : (set.params[attr] || '--')}
                                                        <span className="text-[10px] ml-0.5 font-bold opacity-40">{getUnit(attr)}</span>
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center py-20 text-surface-200 bg-surface/50 rounded-[24px] border border-dashed border-surface-200">
                                    <Coffee size={40} strokeWidth={1.5} className="mb-2 opacity-50" />
                                    <p className="text-[12px] font-bold tracking-tight">休息日无需动作安排</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-surface-300">
                            <ArrowRight size={32} className="mb-2 opacity-10" />
                            <p className="text-[11px] font-black uppercase tracking-widest opacity-40">请从左侧选择来源</p>
                        </div>
                    )}
                </div>
            </div>
        </Dialog>
    );
};

export default CopyTrainingDayDialog;