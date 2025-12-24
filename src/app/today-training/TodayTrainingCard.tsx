'use client';

import React from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { useRouter } from 'next/navigation';
import { Play, Video, Info, CheckCircle, RotateCcw } from 'lucide-react';

interface TodayTrainingCardProps {
    day: any; // training_day from instance
    actions: Record<string, any>; // actions map from API
    instanceId: string;
    dayIndex: number;
    executionStatus?: 'none' | 'in_progress' | 'completed';
    completedSets?: number;
    totalSets?: number;
}

const TodayTrainingCard: React.FC<TodayTrainingCardProps> = ({
    day,
    actions,
    instanceId,
    dayIndex,
    executionStatus = 'none',
    completedSets = 0,
    totalSets = 0
}) => {
    const router = useRouter();

    const handleStartTraining = () => {
        router.push(`/training-execution/${instanceId}?dayIndex=${dayIndex}`);
    };

    const actionSets = day.actionSets || [];
    const isCompleted = executionStatus === 'completed';
    const isInProgress = executionStatus === 'in_progress';

    return (
        <Card className={`shadow-lg border-2 ${isCompleted ? 'border-green-500' : 'border-primary-500'}`}>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>📅</span>
                            <span>{new Date().toLocaleDateString('zh-CN', {
                                month: 'long',
                                day: 'numeric',
                                weekday: 'long'
                            })}</span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mt-1 flex items-center gap-2">
                            今日训练
                            {isCompleted && (
                                <span className="inline-flex items-center gap-1 text-green-600 text-base font-medium">
                                    <CheckCircle className="w-5 h-5" />
                                    已完成
                                </span>
                            )}
                            {isInProgress && (
                                <span className="inline-flex items-center gap-1 text-orange-600 text-base font-medium">
                                    进行中
                                </span>
                            )}
                        </h2>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-gray-500">第{dayIndex}天</div>
                        <div className="text-lg font-semibold text-primary-600">
                            {actionSets.length} 个动作
                        </div>
                        {(isCompleted || isInProgress) && (
                            <div className="text-sm text-gray-600 mt-1">
                                {completedSets}/{totalSets} 组完成
                            </div>
                        )}
                    </div>
                </div>

                {/* Completion Summary for completed training */}
                {isCompleted && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <div className="font-bold text-green-800">训练已完成！</div>
                                <div className="text-green-600 text-sm">
                                    完成 {completedSets}/{totalSets} 组 · 
                                    今日训练目标达成 🎉
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Action List */}
                <div className="space-y-3">
                    {actionSets.map((actionSet: any, idx: number) => {
                        // 支持两种字段名: action_id 和 actionId
                        const actionId = actionSet.action_id || actionSet.actionId;
                        const action = actions[actionId];
                        
                        return (
                            <div
                                key={idx}
                                className={`bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-primary-300 transition-colors ${isCompleted ? 'opacity-80' : ''}`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-6 h-6 ${isCompleted ? 'bg-green-500' : 'bg-primary-500'} text-white rounded-full flex items-center justify-center text-sm font-bold`}>
                                                {isCompleted ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                                            </span>
                                            <h3 className="font-semibold text-gray-900">
                                                {action?.name || actionSet.set_name || '未知动作'}
                                            </h3>
                                        </div>
                                        
                                        <div className="mt-2 flex flex-wrap gap-3 text-sm">
                                            <span className="text-gray-600">
                                                <strong>{actionSet.params?.['组数'] || actionSet.sets}组</strong> × <strong>{actionSet.params?.['次数'] || actionSet.reps}次</strong>
                                            </span>
                                            {(actionSet.params?.['强度'] || actionSet.intensity) && (
                                                <span className="text-gray-600">
                                                    💪 {actionSet.params?.['强度'] || actionSet.intensity}
                                                </span>
                                            )}
                                            {(actionSet.params?.['休息时间'] || actionSet.rest_seconds) && (
                                                <span className="text-gray-600">
                                                    ⏱️ 休息{((actionSet.params?.['休息时间'] || actionSet.rest_seconds) / 60).toFixed(1)}分钟
                                                </span>
                                            )}
                                        </div>

                                        {action?.detail && (
                                            <div className="mt-2 text-xs text-gray-500 line-clamp-2">
                                                {action.detail}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2 ml-4">
                                        {action?.url && (
                                            <button
                                                onClick={() => window.open(action.url, '_blank')}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="查看视频"
                                            >
                                                <Video className="w-5 h-5" />
                                            </button>
                                        )}
                                        {action?.detail && (
                                            <button
                                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                title={action.detail}
                                            >
                                                <Info className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Button based on status */}
                {isCompleted ? (
                        <Button
                        label="查看记录"
                        icon={<CheckCircle className="w-5 h-5" />}
                        onClick={handleStartTraining}
                        className="w-full !py-3"
                        severity="secondary"
                        outlined
                    />
                ) : isInProgress ? (
                    <Button
                        label="继续训练"
                        icon={<Play className="w-5 h-5" />}
                        onClick={handleStartTraining}
                        className="w-full !py-4 !text-lg font-bold"
                        severity="warning"
                    />
                ) : (
                    <Button
                        label="开始训练"
                        icon={<Play className="w-5 h-5" />}
                        onClick={handleStartTraining}
                        className="w-full !py-4 !text-lg font-bold"
                        severity="success"
                    />
                )}
            </div>
        </Card>
    );
};

export default TodayTrainingCard;
