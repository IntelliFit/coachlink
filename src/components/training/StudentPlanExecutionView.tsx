'use client';

import React, { useState, useEffect } from 'react';
import { Button } from 'primereact/button';
import { Badge } from 'primereact/badge';
import { Card } from 'primereact/card';
import { Divider } from 'primereact/divider';
import { Dialog } from 'primereact/dialog';
import { Skeleton } from 'primereact/skeleton';
import { planLibService } from '@/app/service/planLibService';
import { CoachPlanInstanceRow, CoachActionRow } from '@/types';
import { CoachPlanAction, CoachPlanTrainingDay } from '@/app/api/plan-lib/create-template/entity';

interface StudentPlanExecutionViewProps {
    subscriptionId: string;
}

interface TrainingDay {
    dayIndex: number;
    type: 'training' | 'rest';
    note?: string;
    actionSets?: CoachPlanAction[];
}

/**
 * StudentPlanExecutionView - 学员计划执行情况展示组件
 * 
 * 复用自学员端 /coach/plans 页面的展示逻辑
 * 教练可在此组件中查看学员的训练执行情况
 */
const StudentPlanExecutionView: React.FC<StudentPlanExecutionViewProps> = ({ subscriptionId }) => {
    const [instance, setInstance] = useState<CoachPlanInstanceRow | null>(null);
    const [actions, setActions] = useState<Record<string, CoachActionRow>>({});
    const [executions, setExecutions] = useState<Record<number, any>>({});
    const [loading, setLoading] = useState(true);
    const [videoModalVisible, setVideoModalVisible] = useState(false);
    const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!subscriptionId) return;
        loadData();
    }, [subscriptionId]);

    const loadData = async () => {
        try {
            setLoading(true);
            
            // 获取计划实例
            const res = await planLibService.getInstance({ subscriptionId });
            if (res?.instance) {
                setInstance(res.instance);
                if (res.actions) {
                    setActions(res.actions);
                }
            }

            // 获取执行数据
            try {
                const exeRes = await planLibService.getWithExecutions({ subscriptionId });
                if (exeRes?.executions) {
                    setExecutions(exeRes.executions);
                }
            } catch (e) {
                console.log('No execution data available');
            }
        } catch (error) {
            console.error('加载计划数据失败:', error);
        } finally {
            setLoading(false);
        }
    };

    // 获取星期名称
    const getDayName = (dayIndex: number) => {
        return `第${dayIndex}天`;
    };

    // 计算训练日期
    const getTrainingDate = (dayIndex: number) => {
        const today = new Date();
        const trainingDate = new Date(today);
        trainingDate.setDate(today.getDate() + (dayIndex - 1));
        return trainingDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' });
    };

    // 执行详情组件
    const ExecutionDetailsSection = ({ execution }: { execution: any }) => {
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
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 mb-3 border border-green-200">
                    <span className="text-sm font-semibold text-green-700 flex items-center gap-2">
                        <i className="pi pi-check-circle" />
                        学员执行情况
                    </span>
                </div>
                <div className="overflow-x-auto">
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
                                                onClick={() => {
                                                    setCurrentVideoUrl(set.video_url);
                                                    setVideoModalVisible(true);
                                                }}
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
            </div>
        );
    };

    // 动作项显示组件
    const ActionItem = ({ actionSet, action }: { actionSet: CoachPlanAction; action?: any }) => {
        const actionName = action?.name || actionSet.setName || '未知动作';
        const hasVideo = !!action?.url;

        return (
            <div className="flex items-center justify-between py-3 px-4 bg-surface-50 rounded-lg hover:bg-surface-100 transition-colors">
                <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center gap-2 text-surface-500">
                        <i className="pi pi-th-large text-sm" />
                        <span className="text-sm">{(actionSet as any).params?.['组数'] || 3}组×{(actionSet as any).params?.['次数'] || 8}次</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <i className="pi pi-box text-sm text-surface-500" />
                        <span className="font-medium text-surface-900">{actionName}</span>
                    </div>
                    {((actionSet as any).params?.['休息时间']) && (
                        <div className="flex items-center gap-1 text-surface-500">
                            <i className="pi pi-clock text-xs" />
                            <span className="text-sm">休息{(((actionSet as any).params?.['休息时间']) / 60).toFixed(1)}分钟</span>
                        </div>
                    )}
                </div>
                {hasVideo && (
                    <Button
                        icon="pi pi-video"
                        rounded
                        text
                        size="small"
                        className="text-primary"
                        onClick={() => window.open(action?.url, '_blank')}
                    />
                )}
            </div>
        );
    };

    // 训练日卡片
    const TrainingDayCard = ({ day }: { day: TrainingDay }) => {
        const isRestDay = day.type === 'rest';
        const actionSets = day.actionSets || [];
        const dayExecution = executions[day.dayIndex];

        if (isRestDay) {
            return (
                <div className="border border-surface-200 rounded-xl p-4 bg-surface-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <i className="pi pi-moon text-blue-600" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-semibold text-surface-900">{getDayName(day.dayIndex)}</h4>
                            <p className="text-sm text-surface-500">休息日 · {getTrainingDate(day.dayIndex)}</p>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="border border-surface-200 rounded-xl overflow-hidden">
                {/* 训练日头部 */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/5 to-primary/10 border-b border-surface-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                            <i className="pi pi-bolt text-primary" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-semibold text-surface-900">{getDayName(day.dayIndex)}</h4>
                            <p className="text-sm text-surface-600">
                                {getTrainingDate(day.dayIndex)} · {actionSets.length} 个动作
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {dayExecution && (
                            <Badge value="已执行" severity="success" className="rounded-full" />
                        )}
                        <Badge value="训练日" severity="success" className="rounded-full" />
                    </div>
                </div>

                {/* 动作列表 */}
                <div className="p-4 space-y-2">
                    {actionSets.map((actionSet, idx) => {
                        const actionId = (actionSet as any).action_id || (actionSet as any).actionId;
                        return (
                            <ActionItem
                                key={idx}
                                actionSet={actionSet}
                                action={actions[actionId]}
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

                {/* 执行详情 */}
                {dayExecution && (
                    <div className="px-4 pb-4">
                        <ExecutionDetailsSection execution={dayExecution} />
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton width="100%" height="80px" />
                <Skeleton width="100%" height="200px" />
                <Skeleton width="100%" height="200px" />
            </div>
        );
    }

    if (!instance) {
        return (
            <div className="text-center py-8 text-surface-500">
                <i className="pi pi-inbox text-4xl mb-3" />
                <p>暂无训练计划</p>
            </div>
        );
    }

    const trainingDays = (instance.training_days as unknown as TrainingDay[] || [])
        .sort((a, b) => a.dayIndex - b.dayIndex);

    return (
        <div className="space-y-6">
            {/* 计划标题 */}
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-xl font-bold text-surface-900 mb-1">
                        {instance.name || '训练计划'}
                    </h2>
                    <p className="text-surface-600 text-sm">
                        {instance.description || '暂无描述'}
                    </p>
                </div>
            </div>

            {/* 训练日列表 */}
            <div>
                <h3 className="text-lg font-semibold text-surface-900 mb-4 flex items-center gap-2">
                    <i className="pi pi-calendar-plus text-primary" />
                    训练安排
                </h3>
                <div className="space-y-4">
                    {trainingDays.map((day, idx) => (
                        <TrainingDayCard key={idx} day={day} />
                    ))}
                    {trainingDays.length === 0 && (
                        <div className="text-center py-8 text-surface-500">
                            <i className="pi pi-inbox text-4xl mb-3" />
                            <p>暂无训练安排</p>
                        </div>
                    )}
                </div>
            </div>

            {/* 视频播放模态框 */}
            <Dialog
                visible={videoModalVisible}
                onHide={() => {
                    setVideoModalVisible(false);
                    setCurrentVideoUrl(null);
                }}
                header="查看训练视频"
                style={{ width: '90vw', maxWidth: '800px' }}
                modal
                dismissableMask
            >
                {currentVideoUrl && (
                    <div className="flex justify-center">
                        <video
                            src={currentVideoUrl}
                            controls
                            autoPlay
                            className="w-full max-h-[70vh] rounded-lg"
                            style={{ backgroundColor: '#000' }}
                        >
                            您的浏览器不支持视频播放
                        </video>
                    </div>
                )}
            </Dialog>
        </div>
    );
};

export default StudentPlanExecutionView;
