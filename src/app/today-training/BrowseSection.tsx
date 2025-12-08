'use client';

import React, { useState } from 'react';
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
    const selectedDay = trainingDays.find(d => d.dayIndex === selectedDayIndex);

    // Calculate dates for each day
    const getDayDate = (dayIndex: number) => {
        const startDate = new Date(instance.created_at);
        const dayDate = new Date(startDate);
        dayDate.setDate(startDate.getDate() + (dayIndex - 1));
        return dayDate;
    };

    const isToday = (dayIndex: number) => {
        const today = new Date();
        const dayDate = getDayDate(dayIndex);
        return today.toDateString() === dayDate.toDateString();
    };

    // Get unique day indexes (1-7 for week view)
    const weekDays = Array.from({ length: 7 }, (_, i) => i + 1);

    return (
        <div className="mt-8">
            <Card>
                <h3 className="text-lg font-bold text-gray-900 mb-4">浏览其他训练日</h3>
                
                {/* Week Calendar */}
                <div className="bg-white rounded-xl p-4 mb-6">
                    <div className="grid grid-cols-7 gap-2">
                        {weekDays.map((dayIndex) => {
                            const dayDate = getDayDate(dayIndex);
                            const day = trainingDays.find(d => d.dayIndex === dayIndex);
                            const isTrainingDay = day && day.type === 'training';
                            const isTodayBool = isToday(dayIndex);
                            const isSelected = selectedDayIndex === dayIndex;

                            return (
                                <button
                                    key={dayIndex}
                                    onClick={() => setSelectedDayIndex(dayIndex)}
                                    className={`
                                        flex flex-col items-center justify-center p-3 rounded-lg transition-all
                                        ${isSelected 
                                            ? 'bg-primary-500 text-white shadow-md scale-105' 
                                            : isTrainingDay
                                            ? 'bg-gray-50 hover:bg-gray-100'
                                            : 'bg-gray-50 opacity-60 hover:opacity-80'}
                                        ${isTodayBool && !isSelected ? 'ring-2 ring-primary-500' : ''}
                                    `}
                                >
                                    <div className={`text-xs mb-1 ${isSelected ? 'text-white opacity-90' : 'text-gray-500'}`}>
                                        {dayDate.toLocaleDateString('zh-CN', { weekday: 'short' })}
                                    </div>
                                    <div className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                                        {dayDate.getDate()}
                                    </div>
                                    <div className={`text-xs mt-1 truncate max-w-full ${isSelected ? 'text-white opacity-90' : 'text-gray-600'}`}>
                                        {isTrainingDay ? '训练' : '休息'}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Selected Day Preview */}
                {selectedDay ? (
                    selectedDay.type === 'training' ? (
                        <div>
                            <div className="mb-4">
                                <h4 className="font-semibold text-gray-900">
                                    {getDayDate(selectedDayIndex).toLocaleDateString('zh-CN', {
                                        month: 'long',
                                        day: 'numeric',
                                        weekday: 'long'
                                    })}
                                </h4>
                                <p className="text-sm text-gray-500">
                                    {selectedDay.actionSets?.length || 0} 个动作
                                </p>
                            </div>

                            <div className="space-y-2 mb-4">
                                {(selectedDay.actionSets || []).map((actionSet: any, idx: number) => {
                                    const action = actions[actionSet.action_id];
                                    return (
                                        <div key={idx} className="bg-gray-50 rounded p-3 text-sm">
                                            <div className="font-medium">
                                                {idx + 1}. {action?.name || actionSet.set_name}
                                            </div>
                                            <div className="text-gray-600">
                                                {actionSet.sets}组 × {actionSet.reps}次
                                                {actionSet.intensity && ` · ${actionSet.intensity}`}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Button based on whether it's today and execution status */}
                            {isToday(selectedDayIndex) && todayExecutionStatus === 'completed' ? (
                                <Button
                                    label="查看记录"
                                    icon={<Eye className="w-5 h-5" />}
                                    onClick={() => router.push(`/training-execution/${instance.id}?dayIndex=${selectedDayIndex}`)}
                                    className="w-full"
                                    severity="secondary"
                                    outlined
                                />
                            ) : isToday(selectedDayIndex) && todayExecutionStatus === 'in_progress' ? (
                                <Button
                                    label="继续训练"
                                    icon={<Play className="w-5 h-5" />}
                                    onClick={() => router.push(`/training-execution/${instance.id}?dayIndex=${selectedDayIndex}`)}
                                    className="w-full"
                                    severity="warning"
                                />
                            ) : (
                                <Button
                                    label={isToday(selectedDayIndex) ? "开始训练" : "查看训练"}
                                    icon={<Play className="w-5 h-5" />}
                                    onClick={() => router.push(`/training-execution/${instance.id}?dayIndex=${selectedDayIndex}`)}
                                    className="w-full"
                                    severity={isToday(selectedDayIndex) ? "success" : "info"}
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
