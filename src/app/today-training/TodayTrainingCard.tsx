'use client';

import React, { useMemo, useState } from 'react';
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
    const [showAllActions, setShowAllActions] = useState(false);

    const handleStartTraining = () => {
        router.push(`/training-execution/${instanceId}?dayIndex=${dayIndex}`);
    };

    const actionSets = day.actionSets || [];
    const isCompleted = executionStatus === 'completed';
    const isInProgress = executionStatus === 'in_progress';

    const visibleActionSets = useMemo(() => {
        // 移动端首屏更聚焦：默认只展示前几个动作，避免信息过载；用户可展开查看全部
        const maxPreview = 4;
        return showAllActions ? actionSets : actionSets.slice(0, maxPreview);
    }, [actionSets, showAllActions]);

    const hiddenCount = Math.max(0, actionSets.length - visibleActionSets.length);

    return (
        <Card
            id="guide-today-card"
            className={`shadow-lg border-2 rounded-3xl ${isCompleted ? 'border-green-500' : 'border-primary-500'}`}
        >
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-sm text-surface-500">
                            <span>📅</span>
                            <span>{new Date().toLocaleDateString('zh-CN', {
                                month: 'long',
                                day: 'numeric',
                                weekday: 'long'
                            })}</span>
                        </div>
                        <h2 className="text-2xl font-bold text-surface-900 mt-1 flex items-center gap-2">
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
                    <div className="sm:text-right">
                        <div className="text-sm text-surface-500">第{dayIndex}天</div>
                        <div className="text-lg font-semibold text-primary-600">
                            {actionSets.length} 个动作
                        </div>
                        {(isCompleted || isInProgress) && (
                            <div className="text-sm text-surface-600 mt-1">
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
                    {visibleActionSets.map((actionSet: any, idx: number) => {
                        // 支持两种字段名: action_id 和 actionId
                        const actionId = actionSet.action_id || actionSet.actionId;
                        const action = actions[actionId];
                        
                        return (
                            <div
                                key={idx}
                                className={`bg-surface-50 rounded-2xl p-4 border border-surface-200 hover:border-primary-300 transition-colors ${isCompleted ? 'opacity-80' : ''}`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-6 h-6 ${isCompleted ? 'bg-green-500' : 'bg-primary-500'} text-white rounded-full flex items-center justify-center text-sm font-bold`}>
                                                {isCompleted ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                                            </span>
                                            <h3 className="font-semibold text-surface-900">
                                                {action?.name || actionSet.set_name || '未知动作'}
                                            </h3>
                                        </div>
                                        
                                        <div className="mt-2 flex flex-wrap gap-3 text-sm">
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
                                                                {params.suggested_time && ` · ${params.suggested_time}`}
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
                                                                {customData.target_duration && ` · ${customData.target_duration}分钟`}
                                                            </span>
                                                        );
                                                    case 'STRENGTH':
                                                    default:
                                                        return (
                                                            <>
                                                                <span className="text-surface-600">
                                                                    <strong>{params['组数'] || actionSet.sets || 1}组</strong> × <strong>{params['次数'] || actionSet.reps || 1}次</strong>
                                                                </span>
                                                                {/* 优先显示计算后的重量，否则显示RM强度 */}
                                                                {(() => {
                                                                    const load = params.load;
                                                                    const intensity = params['强度'] || actionSet.intensity;
                                                                    
                                                                    if (load && load > 0) {
                                                                        return (
                                                                            <span className="text-green-600 font-medium">
                                                                                💪 {load}kg
                                                                            </span>
                                                                        );
                                                                    } else if (intensity) {
                                                                        return (
                                                                            <span className="text-surface-600">
                                                                                💪 {intensity}
                                                                            </span>
                                                                        );
                                                                    }
                                                                    return null;
                                                                })()}
                                                            </>
                                                        );
                                                }
                                            })()}
                                            {(actionSet.params?.['休息时间'] || actionSet.rest_seconds) && (
                                                <span className="text-surface-600">
                                                    ⏱️ 休息{((actionSet.params?.['休息时间'] || actionSet.rest_seconds) / 60).toFixed(1)}分钟
                                                </span>
                                            )}
                                        </div>

                                        {action?.detail && (
                                            <div className="mt-2 text-xs text-surface-500 line-clamp-2">
                                                {action.detail}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2 ml-4">
                                        {action?.url && (
                                            <button
                                                onClick={() => window.open(action.url, '_blank')}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                                                title="查看视频"
                                            >
                                                <Video className="w-5 h-5" />
                                            </button>
                                        )}
                                        {action?.detail && (
                                            <button
                                                className="p-2 text-surface-600 hover:bg-surface-100 rounded-xl transition-colors"
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

                {/* 展开/收起：移动端默认预览，避免列表过长 */}
                {actionSets.length > visibleActionSets.length && (
                    <button
                        type="button"
                        onClick={() => setShowAllActions(true)}
                        className="w-full py-3 rounded-2xl border border-surface-200 bg-surface hover:bg-surface-50 text-surface-700 font-medium transition-all active:scale-[0.99]"
                    >
                        展开查看全部（还有 {hiddenCount} 个动作）
                    </button>
                )}
                {showAllActions && actionSets.length > 4 && (
                    <button
                        type="button"
                        onClick={() => setShowAllActions(false)}
                        className="w-full py-2 rounded-2xl text-surface-500 hover:text-surface-700 hover:bg-surface-50 transition-all active:scale-[0.99]"
                    >
                        收起预览
                    </button>
                )}

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
                        id="guide-start-training"
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
