'use client';

import React, { useState, useMemo } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Check, Play, Eye } from 'lucide-react';
import { calculateCurrentWeek, isDayUnlocked, getDayWeekNumber, formatUnlockDate, getUnlockDate } from '@/lib/weekUnlock';

interface BrowseSectionProps {
    instance: any;
    actions: Record<string, any>;
    currentDayIndex: number;
    todayExecutionStatus?: 'none' | 'in_progress' | 'completed';
    completionDates?: Record<number, string>;  // 每个训练日的完成日期
    todayCompleted?: boolean;                  // 今天是否已完成训练
}

const BrowseSection: React.FC<BrowseSectionProps> = ({
    instance,
    actions,
    currentDayIndex,
    todayExecutionStatus = 'none',
    completionDates = {},
    todayCompleted = false
}) => {
    const router = useRouter();
    const [selectedDayIndex, setSelectedDayIndex] = useState(currentDayIndex);
    
    const trainingDays = (instance?.training_days || []) as any[];
    const startExecutionDay = instance?.start_execution_day || 1;
    
    // 计算总周数
    const totalWeeks = Math.ceil(trainingDays.length / 7);
    
    // 根据当前选中的天计算当前显示的周
    const [currentWeek, setCurrentWeek] = useState(() => {
        const startWeek = Math.ceil(currentDayIndex / 7);
        return Math.max(1, Math.min(startWeek, totalWeeks));
    });
    
    // 🔒 计算已解锁的周次（基于计划开始日期）
    const unlockedWeek = useMemo(() => {
        return calculateCurrentWeek(instance?.start_date);
    }, [instance?.start_date]);
    
    // 计算当前周的训练日范围
    const weekDays = useMemo(() => {
        const startDay = (currentWeek - 1) * 7 + 1;
        const endDay = currentWeek * 7;
        return Array.from({ length: 7 }, (_, i) => startDay + i).filter(d => d <= trainingDays.length);
    }, [currentWeek, trainingDays.length]);
    
    // 检查当前显示的周是否已解锁
    const isCurrentWeekUnlocked = currentWeek <= unlockedWeek;
    
    const selectedDay = trainingDays.find(d => d.dayIndex === selectedDayIndex);

    // 获取训练日的完成日期（如果已完成）或null
    const getCompletedDate = (dayIndex: number): Date | null => {
        const dateStr = completionDates[dayIndex];
        return dateStr ? new Date(dateStr) : null;
    };

    // 检查训练日是否已完成
    const isDayCompleted = (dayIndex: number): boolean => {
        return !!completionDates[dayIndex];
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
        <div className="mt-8">
            <Card>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4">
                    <h3 className="text-lg font-bold text-surface-900">浏览训练日</h3>
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
                
                {/* Week Calendar */}
                <div className="bg-surface rounded-2xl p-3 sm:p-4 mb-6 relative">
                    {/* 📝 制定中周遮罩 */}
                    {!isCurrentWeekUnlocked && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-surface-900/10 backdrop-blur-sm rounded-xl">
                            <div className="bg-white/90 rounded-2xl p-6 shadow-lg text-center max-w-xs">
                                <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <i className="pi pi-pencil text-2xl text-amber-500" />
                                </div>
                                <h4 className="text-lg font-bold text-gray-800 mb-1">第 {currentWeek} 周内容制定中</h4>
                                <p className="text-sm text-gray-500 mb-2">
                                    {(() => {
                                        const unlockDate = getUnlockDate(currentWeek, instance?.start_date);
                                        if (unlockDate) {
                                            return `预计 ${formatUnlockDate(unlockDate)} 发布`;
                                        }
                                        return '教练正在为您精心准备训练内容';
                                    })()}
                                </p>
                                <p className="text-xs text-gray-400">
                                    专属计划，逐周发布
                                </p>
                            </div>
                        </div>
                    )}
                    
                    <div className={`grid grid-cols-7 gap-2 ${!isCurrentWeekUnlocked ? 'opacity-30 pointer-events-none' : ''}`}>
                        {weekDays.map((dayIndex) => {
                            const day = trainingDays.find(d => d.dayIndex === dayIndex);
                            const isTrainingDay = day && day.type === 'training';
                            const isRecommended = dayIndex === currentDayIndex; // 推荐的下一个训练日
                            const isSelected = selectedDayIndex === dayIndex;
                            const isBeforeStart = dayIndex < startExecutionDay; // 在起始执行天之前
                            const isStartDay = dayIndex === startExecutionDay && startExecutionDay > 1;
                            const isCompleted = isDayCompleted(dayIndex); // 检查是否已完成

                            return (
                                <button
                                    key={dayIndex}
                                    onClick={() => setSelectedDayIndex(dayIndex)}
                                    disabled={!isCurrentWeekUnlocked}
                                    className={`
                                        relative flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl transition-all
                                        ${isSelected 
                                            ? 'bg-primary-500 text-white shadow-md scale-105' 
                                            : isBeforeStart
                                            ? 'bg-gray-100 opacity-50'
                                            : isCompleted
                                            ? 'bg-green-50 border border-green-200'
                                            : isTrainingDay
                                            ? 'bg-gray-50 hover:bg-gray-100'
                                            : 'bg-gray-50 opacity-60 hover:opacity-80'}
                                        ${isRecommended && !isSelected && !todayCompleted ? 'ring-2 ring-primary-500' : ''}
                                        ${isStartDay && !isSelected ? 'ring-2 ring-green-500' : ''}
                                    `}
                                >
                                    {/* 起始执行天标记 */}
                                    {isStartDay && (
                                        <div className="absolute -top-1 -right-1 bg-green-500 text-white text-[8px] px-1 rounded-full">
                                            开始
                                        </div>
                                    )}
                                    
                                    {/* 已完成标记 */}
                                    {(isBeforeStart || isCompleted) && (
                                        <div className={`absolute -top-1 -right-1 ${isCompleted ? 'bg-green-500' : 'bg-gray-400'} text-white text-[8px] p-0.5 rounded-full`}>
                                            <Check className="w-2 h-2" />
                                        </div>
                                    )}
                                    
                                    <div className={`text-[10px] sm:text-xs mb-1 ${isSelected ? 'text-white opacity-90' : 'text-surface-500'}`}>
                                        第{dayIndex}天
                                    </div>
                                    <div className={`text-base sm:text-lg font-bold ${isSelected ? 'text-white' : isCompleted ? 'text-green-700' : 'text-surface-900'}`}>
                                        {dayIndex}
                                    </div>
                                    <div className={`text-[10px] sm:text-xs mt-1 truncate max-w-full ${isSelected ? 'text-white opacity-90' : isCompleted ? 'text-green-600' : 'text-surface-600'}`}>
                                        {isBeforeStart ? '已完成' : isCompleted ? '✓ 已完成' : isTrainingDay ? '训练' : '休息'}
                                        {isRecommended && !isSelected && !todayCompleted && ' 📍'}
                                    </div>
                                </button>
                            );
                        })}
                        
                        {/* 填充空位 */}
                        {Array.from({ length: 7 - weekDays.length }).map((_, i) => (
                            <div key={`empty-${i}`} className="p-3 rounded-lg bg-gray-50 opacity-30" />
                        ))}
                    </div>
                </div>

                {/* Selected Day Preview */}
                {!isCurrentWeekUnlocked ? (
                    /* 制定中周的预览区域 */
                    <div className="text-center py-8 bg-amber-50/50 rounded-xl border border-amber-100">
                        <i className="pi pi-pencil text-2xl text-amber-400 mb-3" />
                        <p className="text-amber-600 text-sm font-medium">本周训练内容制定中</p>
                        <p className="text-amber-400 text-xs mt-1">教练正在精心准备，敬请期待</p>
                    </div>
                ) : selectedDay ? (
                    selectedDay.type === 'training' ? (
                        <div>
                            <div className="mb-4">
                                <h4 className="font-semibold text-gray-900">
                                    第 {selectedDayIndex} 天
                                    {isDayCompleted(selectedDayIndex) && (
                                        <span className="ml-2 text-sm text-green-600">
                                            ✓ {getCompletedDate(selectedDayIndex)?.toLocaleDateString('zh-CN', {
                                                month: 'long',
                                                day: 'numeric'
                                            })} 已完成
                                        </span>
                                    )}
                                    {selectedDayIndex < startExecutionDay && (
                                        <span className="ml-2 text-sm text-gray-400">(线下已完成)</span>
                                    )}
                                </h4>
                                <p className="text-sm text-gray-500">
                                    {selectedDay.actionSets?.length || 0} 个动作
                                </p>
                            </div>

                            <div className="space-y-2 mb-4">
                                {(selectedDay.actionSets || []).map((actionSet: any, idx: number) => {
                                    // 支持两种字段名: action_id 和 actionId
                                    const actionId = actionSet.action_id || actionSet.actionId;
                                    const action = actions[actionId];
                                    const load = actionSet.params?.load;
                                    const intensity = actionSet.params?.['强度'] || actionSet.intensity;
                                    
                                    return (
                                        <div key={idx} className="bg-gray-50 rounded p-3 text-sm">
                                            <div className="font-medium">
                                                {idx + 1}. {action?.name || actionSet.set_name}
                                            </div>
                                            <div className="text-gray-600 flex flex-wrap gap-2">
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
                                                                        {params['组数'] || actionSet.sets || 1}组 × {params['次数'] || actionSet.reps || 1}次
                                                                    </span>
                                                                    {load && load > 0 ? (
                                                                        <span className="text-green-600 font-medium">💪 {load}kg</span>
                                                                    ) : intensity ? (
                                                                        <span>· {intensity}</span>
                                                                    ) : null}
                                                                </>
                                                            );
                                                    }
                                                })()}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Button based on whether it's recommended day and execution status */}
                            {selectedDayIndex < startExecutionDay ? (
                                <Button
                                    label="线下已完成"
                                    icon={<Check className="w-5 h-5" />}
                                    className="w-full"
                                    severity="secondary"
                                    disabled
                                />
                            ) : selectedDayIndex === currentDayIndex && todayExecutionStatus === 'completed' ? (
                                <Button
                                    label="查看记录"
                                    icon={<Eye className="w-5 h-5" />}
                                    onClick={() => router.push(`/training-execution/${instance.id}?dayIndex=${selectedDayIndex}`)}
                                    className="w-full"
                                    severity="secondary"
                                    outlined
                                />
                            ) : selectedDayIndex === currentDayIndex && todayExecutionStatus === 'in_progress' ? (
                                <Button
                                    label="继续训练"
                                    icon={<Play className="w-5 h-5" />}
                                    onClick={() => router.push(`/training-execution/${instance.id}?dayIndex=${selectedDayIndex}`)}
                                    className="w-full"
                                    severity="warning"
                                />
                            ) : (
                                <Button
                                    label={selectedDayIndex === currentDayIndex ? "开始训练" : "查看训练"}
                                    icon={<Play className="w-5 h-5" />}
                                    onClick={() => router.push(`/training-execution/${instance.id}?dayIndex=${selectedDayIndex}`)}
                                    className="w-full"
                                    severity={selectedDayIndex === currentDayIndex ? "success" : "info"}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <div className="text-6xl mb-4">😌</div>
                            <h4 className="text-xl font-bold text-gray-900 mb-2">休息日</h4>
                            <p className="text-gray-600">今天好好休息，为下次训练做准备</p>
                        </div>
                    )
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        请选择日期查看训练内容
                    </div>
                )}
            </Card>
        </div>
    );
};

export default BrowseSection;
