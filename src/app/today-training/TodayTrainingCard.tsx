'use client';

import React, { useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { useRouter } from 'next/navigation';
import { Play, Video, Info, CheckCircle, RotateCcw } from 'lucide-react';
import { formatKgValueForGym } from '@/lib/weightQuantize';

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
    const [infoDialog, setInfoDialog] = useState<{ title: string; detail: string } | null>(null);

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
        <div
            id="guide-today-card"
            className={`bg-surface border rounded-2xl ${isCompleted ? 'border-green-100/50 bg-green-50/30' : 'border-surface-100/50'} p-4 sm:p-6`}
        >
            <div className="space-y-4 sm:space-y-6">
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
                        <h2 className="text-xl sm:text-2xl font-bold text-surface-900 mt-1 flex items-center gap-2 tracking-tight">
                            今日训练
                            {isCompleted && (
                                <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-sm font-medium">
                                    <CheckCircle className="w-4 h-4" />
                                    已完成
                                </span>
                            )}
                            {isInProgress && (
                                <span className="inline-flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full text-sm font-medium">
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
                    <div className="bg-green-50 border border-green-100/50 rounded-2xl p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-6 h-6 text-surface" />
                            </div>
                            <div>
                                <div className="font-bold text-green-800 tracking-tight">训练已完成！</div>
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
                        const noteText = String(actionSet?.params?.note || actionSet?.note || '').trim();
                        
                        return (
                            <div
                                key={idx}
                                className={`bg-surface-50 rounded-2xl p-4 border border-surface-100/50 hover:border-primary-200/50 transition-all active:scale-[0.98] ${isCompleted ? 'opacity-80' : ''}`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-6 h-6 ${isCompleted ? 'bg-green-600' : 'bg-primary-600'} text-surface rounded-full flex items-center justify-center text-sm font-bold`}>
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
                                                                    {(() => {
                                                                        const parsePositiveIntOrNull = (v: any) => {
                                                                            if (v === null || v === undefined || v === '') return null;
                                                                            const n = Number(v);
                                                                            if (!Number.isFinite(n) || n <= 0) return null;
                                                                            return Math.floor(n);
                                                                        };
                                                                        const sets = parsePositiveIntOrNull(params['组数'] ?? actionSet.sets) ?? 1;
                                                                        const reps = parsePositiveIntOrNull(params['次数'] ?? actionSet.reps);
                                                                        const durationSeconds = parsePositiveIntOrNull(params['持续时间'] ?? actionSet.durationSeconds);
                                                                        const secondPart = durationSeconds !== null
                                                                            ? `${durationSeconds}秒`
                                                                            : (reps !== null ? `${reps}次` : '自选');
                                                                        return (
                                                                            <>
                                                                                <strong>{sets}组</strong> × <strong>{secondPart}</strong>
                                                                            </>
                                                                        );
                                                                    })()}
                                                                </span>
                                                                {/* 优先显示计算后的重量，否则显示RM强度 */}
                                                                {(() => {
                                                                    const load = params.load;
                                                                    const intensity = params['强度'] || actionSet.intensity;
                                                                    
                                                                    // 有计算后的重量（包括负数表示辅助训练）
                                                                    if (load !== null && load !== undefined) {
                                                                        const numericLoad = Number(load);
                                                                        if (!Number.isFinite(numericLoad)) return null;

                                                                        if (numericLoad < 0) {
                                                                            // 负数表示需要辅助训练
                                                                            return (
                                                                                <span className="text-red-500 font-medium">
                                                                                    💪 辅助{formatKgValueForGym(Math.abs(numericLoad))}kg
                                                                                </span>
                                                                            );
                                                                        } else if (numericLoad > 0) {
                                                                            return (
                                                                                <span className="text-green-600 font-medium">
                                                                                    💪 {formatKgValueForGym(numericLoad)}kg
                                                                                </span>
                                                                            );
                                                                        }
                                                                        // load === 0 时不显示重量
                                                                    }
                                                                    
                                                                    // 只有RM强度，没有计算后的重量
                                                                    if (intensity && intensity > 0) {
                                                                        return (
                                                                            <span className="text-surface-500">
                                                                                💪 {intensity}RM
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

                                        {/* 教练备注：优先在今日训练卡片展示 */}
                                        {noteText && (
                                            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200/50 bg-amber-50 px-3 py-2 text-amber-800">
                                                <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
                                                <div className="text-xs leading-relaxed line-clamp-2">
                                                    {noteText}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2 ml-4">
                                        {action?.url && (
                                            <button
                                                onClick={() => window.open(action.url, '_blank')}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-2xl transition-colors active:scale-[0.98]"
                                                title="查看视频"
                                            >
                                                <Video className="w-5 h-5" />
                                            </button>
                                        )}
                                        {action?.detail && (
                                            <button
                                                onClick={() => setInfoDialog({
                                                    title: action?.name || actionSet.set_name || '动作说明',
                                                    detail: String(action.detail || '').trim(),
                                                })}
                                                className="p-2 text-surface-600 hover:bg-surface-100 rounded-2xl transition-colors active:scale-[0.98]"
                                                title="查看动作说明"
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
                        className="w-full py-3 rounded-2xl border border-surface-100/50 bg-surface hover:bg-surface-50 text-surface-700 font-medium transition-all active:scale-[0.98] duration-200 ease-out"
                    >
                        展开查看全部（还有 {hiddenCount} 个动作）
                    </button>
                )}
                {showAllActions && actionSets.length > 4 && (
                    <button
                        type="button"
                        onClick={() => setShowAllActions(false)}
                        className="w-full py-2 rounded-2xl text-surface-500 hover:text-surface-700 hover:bg-surface-50 transition-all active:scale-[0.98] duration-200 ease-out"
                    >
                        收起预览
                    </button>
                )}

                {/* Why input matters */}
                {executionStatus !== 'completed' && (
                    <div className="text-xs text-surface-600 bg-surface-50 border border-surface-100/50 rounded-2xl px-3 py-2">
                        请输入真实重量/次数：本次后续组会联动校准；系统也会据此更新 e1RM，让下次自动算重量更准。完成后还可分享打卡。
                    </div>
                )}

                {/* Button based on status */}
                {isCompleted ? (
                        <Button
                        label="查看记录"
                        icon={<CheckCircle className="w-5 h-5" />}
                        onClick={handleStartTraining}
                        className="w-full !py-3 rounded-2xl transition-all active:scale-[0.98] duration-200 ease-out"
                        severity="secondary"
                        outlined
                    />
                ) : isInProgress ? (
                    <Button
                        label="继续训练"
                        icon={<Play className="w-5 h-5" />}
                        onClick={handleStartTraining}
                        className="w-full !py-4 !text-lg font-bold rounded-2xl transition-all active:scale-[0.98] duration-200 ease-out"
                        severity="warning"
                    />
                ) : (
                    <Button
                        id="guide-start-training"
                        label="开始训练"
                        icon={<Play className="w-5 h-5" />}
                        onClick={handleStartTraining}
                        className="w-full !py-4 !text-lg font-bold rounded-2xl transition-all active:scale-[0.98] duration-200 ease-out"
                        severity="success"
                    />
                )}
            </div>

            <Dialog
                header={infoDialog?.title || '动作说明'}
                visible={!!infoDialog}
                onHide={() => setInfoDialog(null)}
                draggable={false}
                resizable={false}
                className="w-[min(92vw,520px)]"
            >
                <div className="text-sm text-surface-700 leading-relaxed whitespace-pre-wrap">
                    {infoDialog?.detail || ''}
                </div>
            </Dialog>
        </div>
    );
};

export default TodayTrainingCard;
