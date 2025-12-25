'use client';

import React, { useState, useMemo } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Check, Play, Eye } from 'lucide-react';

interface BrowseSectionProps {
    instance: any;
    actions: Record<string, any>;
    currentDayIndex: number;
    todayExecutionStatus?: 'none' | 'in_progress' | 'completed';
}

const BrowseSection: React.FC<BrowseSectionProps> = ({
    instance,
    actions,
    currentDayIndex,
    todayExecutionStatus = 'none'
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
    
    // 计算当前周的训练日范围
    const weekDays = useMemo(() => {
        const startDay = (currentWeek - 1) * 7 + 1;
        const endDay = currentWeek * 7;
        return Array.from({ length: 7 }, (_, i) => startDay + i).filter(d => d <= trainingDays.length);
    }, [currentWeek, trainingDays.length]);
    
    const selectedDay = trainingDays.find(d => d.dayIndex === selectedDayIndex);

    // Calculate dates for each day - 以当前执行天 = 今天为基准
    const getDayDate = (dayIndex: number) => {
        const today = new Date();
        // 当前执行天 (currentDayIndex) 应该是今天
        // 其他天根据相对偏移计算
        const offset = dayIndex - currentDayIndex;
        const dayDate = new Date(today);
        dayDate.setDate(today.getDate() + offset);
        return dayDate;
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
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900">浏览训练日</h3>
                    <div className="flex items-center gap-2">
                        <Button
                            icon={<ChevronLeft className="w-4 h-4" />}
                            onClick={handlePrevWeek}
                            disabled={currentWeek === 1}
                            className="p-button-text p-button-sm"
                        />
                        <span className="text-sm text-gray-600">第 {currentWeek} 周</span>
                        <Button
                            icon={<ChevronRight className="w-4 h-4" />}
                            onClick={handleNextWeek}
                            disabled={currentWeek === totalWeeks}
                            className="p-button-text p-button-sm"
                        />
                    </div>
                </div>
                
                {/* Week Calendar */}
                <div className="bg-white rounded-xl p-4 mb-6">
                    <div className="grid grid-cols-7 gap-2">
                        {weekDays.map((dayIndex) => {
                            const dayDate = getDayDate(dayIndex);
                            const day = trainingDays.find(d => d.dayIndex === dayIndex);
                            const isTrainingDay = day && day.type === 'training';
                            const isRecommended = dayIndex === currentDayIndex; // 推荐的下一个训练日
                            const isSelected = selectedDayIndex === dayIndex;
                            const isBeforeStart = dayIndex < startExecutionDay; // 在起始执行天之前
                            const isStartDay = dayIndex === startExecutionDay && startExecutionDay > 1;

                            return (
                                <button
                                    key={dayIndex}
                                    onClick={() => setSelectedDayIndex(dayIndex)}
                                    className={`
                                        relative flex flex-col items-center justify-center p-3 rounded-lg transition-all
                                        ${isSelected 
                                            ? 'bg-primary-500 text-white shadow-md scale-105' 
                                            : isBeforeStart
                                            ? 'bg-gray-100 opacity-50'
                                            : isTrainingDay
                                            ? 'bg-gray-50 hover:bg-gray-100'
                                            : 'bg-gray-50 opacity-60 hover:opacity-80'}
                                        ${isRecommended && !isSelected ? 'ring-2 ring-primary-500' : ''}
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
                                    {isBeforeStart && (
                                        <div className="absolute -top-1 -right-1 bg-gray-400 text-white text-[8px] p-0.5 rounded-full">
                                            <Check className="w-2 h-2" />
                                        </div>
                                    )}
                                    
                                    <div className={`text-xs mb-1 ${isSelected ? 'text-white opacity-90' : 'text-gray-500'}`}>
                                        第{dayIndex}天
                                    </div>
                                    <div className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                                        {dayIndex}
                                    </div>
                                    <div className={`text-xs mt-1 truncate max-w-full ${isSelected ? 'text-white opacity-90' : 'text-gray-600'}`}>
                                        {isBeforeStart ? '已完成' : isTrainingDay ? '训练' : '休息'}
                                        {isRecommended && !isSelected && ' 📍'}
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
                {selectedDay ? (
                    selectedDay.type === 'training' ? (
                        <div>
                            <div className="mb-4">
                                <h4 className="font-semibold text-gray-900">
                                    第 {selectedDayIndex} 天 - {getDayDate(selectedDayIndex).toLocaleDateString('zh-CN', {
                                        month: 'long',
                                        day: 'numeric',
                                        weekday: 'long'
                                    })}
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
                                                <span>
                                                    {actionSet.params?.['组数'] || actionSet.sets}组 × {actionSet.params?.['次数'] || actionSet.reps}次
                                                </span>
                                                {load && load > 0 ? (
                                                    <span className="text-green-600 font-medium">💪 {load}kg</span>
                                                ) : intensity ? (
                                                    <span>· {intensity}</span>
                                                ) : null}
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
