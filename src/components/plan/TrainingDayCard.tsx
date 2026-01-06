'use client';

import React, { useState } from 'react';
import { Badge } from 'primereact/badge';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Ripple } from 'primereact/ripple';

// ===============================================
// 这是从 /coach/plans/page.tsx 提取的共享组件
// 用于在不同页面显示一致的训练日卡片和执行记录
// ===============================================

interface TrainingDayCardProps {
    day: any;
    execution?: any;
    actions?: Record<string, any>;
    getDayName?: (dayIndex: number) => string;
    getTrainingDate?: (dayIndex: number) => string;
    defaultCollapsed?: boolean;
    onViewVideo?: (url: string) => void;
}

export const TrainingDayCard: React.FC<TrainingDayCardProps> = ({
    day,
    execution,
    actions = {},
    getDayName,
    getTrainingDate,
    defaultCollapsed = true,
    onViewVideo,
}) => {
    const [executionCollapsed, setExecutionCollapsed] = useState(defaultCollapsed);
    const [videoModalVisible, setVideoModalVisible] = useState(false);
    const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);

    const isRestDay = day.type === 'rest';
    const actionSets = day.actionSets || [];
    const dayExecution = execution;
    const isCompleted = dayExecution?.is_completed || day.completed;

    const dayName = getDayName ? getDayName(day.dayIndex) : `第${day.dayIndex}天`;
    const trainingDate = getTrainingDate ? getTrainingDate(day.dayIndex) : day.date || '';

    const handleViewVideo = (url: string) => {
        if (onViewVideo) {
            onViewVideo(url);
        } else {
            setCurrentVideoUrl(url);
            setVideoModalVisible(true);
        }
    };

    // 休息日
    if (isRestDay) {
        return (
            <div className="border border-surface-200 rounded-xl p-4 bg-surface-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <i className="pi pi-moon text-blue-600" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-semibold text-surface-900">{dayName}</h4>
                        <p className="text-sm text-surface-500">休息日 {trainingDate && `· ${trainingDate}`}</p>
                    </div>
                </div>
            </div>
        );
    }

    // 训练日
    return (
        <div className="border border-surface-200 rounded-xl overflow-hidden">
            {/* 训练日头部 */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/5 to-primary/10 border-b border-surface-200">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                        <i className="pi pi-bolt text-primary" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-semibold text-surface-900">{dayName}</h4>
                        <p className="text-sm text-surface-600">
                            {trainingDate && `${trainingDate} · `}{actionSets.length} 个动作
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isCompleted && (
                        <Badge value="已执行" severity="success" className="rounded-full" />
                    )}
                    <Badge value="训练日" severity="success" className="rounded-full" />
                </div>
            </div>

            {/* 动作列表 */}
            <div className="p-4 space-y-2">
                {actionSets.map((actionSet: any, idx: number) => {
                    const actionId = actionSet.action_id || actionSet.actionId;
                    const action = actionId ? actions[actionId] : null;
                    return (
                        <ActionItem
                            key={idx}
                            actionSet={actionSet}
                            action={action}
                        />
                    );
                })}
                {actionSets.length === 0 && (
                    <p className="text-center text-surface-500 py-4">暂无动作安排</p>
                )}
            </div>

            {/* 训练备注 */}
            {day.note && (
                <div className="px-4 pb-4">
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-start gap-2">
                            <i className="pi pi-info-circle text-amber-600 mt-0.5" />
                            <p className="text-sm text-amber-800">{day.note}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* 执行详情（可折叠） */}
            {dayExecution && dayExecution.action_executions && dayExecution.action_executions.length > 0 && (
                <div className="px-4 pb-4">
                    <ExecutionDetailsSection
                        execution={dayExecution}
                        collapsed={executionCollapsed}
                        onToggle={() => setExecutionCollapsed(!executionCollapsed)}
                        onViewVideo={handleViewVideo}
                    />
                </div>
            )}

            {/* 视频播放弹窗 */}
            <Dialog
                header="训练视频"
                visible={videoModalVisible}
                style={{ width: '90vw', maxWidth: '800px' }}
                onHide={() => setVideoModalVisible(false)}
            >
                {currentVideoUrl && (
                    <video
                        src={currentVideoUrl}
                        controls
                        autoPlay
                        className="w-full rounded-lg"
                    />
                )}
            </Dialog>
        </div>
    );
};

// ===============================================
// 动作项组件 - 完全复制自 /coach/plans/page.tsx
// ===============================================
const ActionItem: React.FC<{ actionSet: any; action?: any }> = ({
    actionSet,
    action,
}) => {
    // 支持多种字段名: actionName, set_name
    const actionName = action?.name || actionSet.actionName || actionSet.set_name || '未知动作';
    const hasVideo = !!action?.url;
    const actionDetail = action?.detail;

    // 从 params 或直接字段读取组数/次数
    const params = actionSet.params || {};
    const sets = params['组数'] || actionSet.sets || 0;
    const reps = params['次数'] || actionSet.reps || 0;

    // 计算重量：优先显示 load（计算后的重量），否则显示 RM
    const load = params.load;
    const intensity = params['强度'] || actionSet.intensity;

    // 休息时间（秒）
    const restSeconds = params['休息时间'] || actionSet.rest_seconds || 0;

    return (
        <div className="flex items-center justify-between py-3 px-4 bg-surface-50 rounded-lg hover:bg-surface-100 transition-colors">
            <div className="flex items-center gap-3 flex-1 flex-wrap">
                {/* 组数×次数 */}
                <div className="flex items-center gap-2 text-surface-500">
                    <i className="pi pi-th-large text-sm" />
                    <span className="text-sm">{sets}组×{reps}次</span>
                </div>

                {/* 动作名称 */}
                <div className="flex items-center gap-2">
                    <i className="pi pi-box text-sm text-surface-500" />
                    <span className="font-medium text-surface-900">{actionName}</span>
                </div>

                {/* 负重 */}
                {load && load > 0 ? (
                    <div className="flex items-center gap-1 text-green-600">
                        <span className="text-sm">💪 {load}kg</span>
                    </div>
                ) : intensity ? (
                    <div className="flex items-center gap-1 text-surface-600">
                        <span className="text-sm">💪 {intensity}RM</span>
                    </div>
                ) : null}

                {/* 休息时间 */}
                {restSeconds > 0 && (
                    <div className="flex items-center gap-1 text-surface-500">
                        <i className="pi pi-clock text-xs" />
                        <span className="text-sm">休息{(restSeconds / 60).toFixed(1)}分钟</span>
                    </div>
                )}
            </div>

            {/* 右侧按钮 */}
            <div className="flex items-center gap-2">
                {hasVideo && (
                    <Button
                        icon="pi pi-video"
                        rounded
                        text
                        size="small"
                        className="text-primary"
                        tooltip="查看动作视频"
                        tooltipOptions={{ position: 'left' }}
                        onClick={() => window.open(action?.url, '_blank')}
                    />
                )}
                {actionDetail && (
                    <Button
                        icon="pi pi-info-circle"
                        rounded
                        text
                        size="small"
                        className="text-info"
                        tooltip={actionDetail}
                        tooltipOptions={{ position: 'left' }}
                    />
                )}
            </div>
        </div>
    );
};

// ===============================================
// 执行详情组件（可折叠）
// ===============================================
interface ExecutionDetailsSectionProps {
    execution: any;
    collapsed: boolean;
    onToggle: () => void;
    onViewVideo: (url: string) => void;
}

const ExecutionDetailsSection: React.FC<ExecutionDetailsSectionProps> = ({
    execution,
    collapsed,
    onToggle,
    onViewVideo,
}) => {
    if (!execution || !execution.action_executions) return null;

    const completedSets = execution.action_executions.flatMap((ae: any) =>
        (ae.sets || []).filter((s: any) => s.status === 'completed').map((s: any) => ({
            ...s,
            action_name: ae.action_name
        }))
    );

    if (completedSets.length === 0) return null;

    return (
        <div className="mt-4 border-t border-surface-200 pt-4">
            {/* 可折叠标题 */}
            <div
                className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 mb-3 border border-green-200 cursor-pointer p-ripple select-none"
                onClick={onToggle}
            >
                <Ripple />
                <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-green-700 flex items-center gap-2">
                        <i className="pi pi-check-circle" />
                        学员执行情况
                        <span className="ml-2 text-green-600 font-normal">
                            ({completedSets.length} 组)
                        </span>
                    </span>
                    <i className={`pi ${collapsed ? 'pi-chevron-down' : 'pi-chevron-up'} text-green-600`} />
                </div>
            </div>

            {/* 执行记录表格 */}
            {!collapsed && (
                <div className="overflow-x-auto animate-fadeIn">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-surface-50 text-surface-600">
                                <th className="px-3 py-2 text-left font-medium">动作</th>
                                <th className="px-3 py-2 text-left font-medium">组数</th>
                                <th className="px-3 py-2 text-left font-medium">重量</th>
                                <th className="px-3 py-2 text-left font-medium">次数</th>
                                <th className="px-3 py-2 text-left font-medium">RPE</th>
                                <th className="px-3 py-2 text-left font-medium">备注</th>
                                <th className="px-3 py-2 text-left font-medium">视频</th>
                            </tr>
                        </thead>
                        <tbody>
                            {completedSets.map((set: any, idx: number) => (
                                <tr key={idx} className="border-t border-surface-100 hover:bg-surface-50">
                                    <td className="px-3 py-2 font-medium text-surface-900">
                                        {set.action_name}
                                        {set.is_pr && <i className="pi pi-star-fill text-yellow-500 ml-2" />}
                                    </td>
                                    <td className="px-3 py-2">第 {set.set_number} 组</td>
                                    <td className="px-3 py-2">{set.actual_weight ? `${set.actual_weight}kg` : '-'}</td>
                                    <td className="px-3 py-2">{set.actual_reps ?? '-'}</td>
                                    <td className="px-3 py-2">
                                        {set.rpe ? (
                                            <span className={set.rpe >= 9 ? 'text-red-600 font-medium' : ''}>
                                                {set.rpe}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-surface-600 max-w-[120px] truncate">
                                        {set.notes || '-'}
                                    </td>
                                    <td className="px-3 py-2">
                                        {set.has_video && set.video_url ? (
                                            <button
                                                onClick={() => onViewVideo(set.video_url)}
                                                className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                            >
                                                <i className="pi pi-video text-sm" />
                                                <span className="text-xs">查看</span>
                                            </button>
                                        ) : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default TrainingDayCard;
