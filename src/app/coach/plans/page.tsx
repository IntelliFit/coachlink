'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { Card } from 'primereact/card';
import { Badge } from 'primereact/badge';
import { Divider } from 'primereact/divider';
import { Dialog } from 'primereact/dialog';
import { subscriptionService } from '@/app/service/subscriptionService';
import { planLibService } from '@/app/service/planLibService';
import { actionLibService } from '@/app/service/actionLibService';
import { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';
import { useToastContext } from '@/context/ToastContext';
import { CoachPlanInstanceRow, CoachActionRow } from '@/types';
import { CoachPlanAction, CoachPlanTrainingDay } from '@/app/api/plan-lib/create-template/entity';

const TrainingPlansHome: React.FC = () => {
    const { data: session } = useSession();
    const { showToast } = useToastContext();

    const [subscriptions, setSubscriptions] = useState<QueryCoachSubscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSubscriptionId, setActiveSubscriptionId] = useState<string | null>(null);
    const [instances, setInstances] = useState<Record<string, CoachPlanInstanceRow | null>>({});
    const [instanceLoading, setInstanceLoading] = useState<Record<string, boolean>>({});
    const [actions, setActions] = useState<Record<string, CoachActionRow>>({});
    const [executions, setExecutions] = useState<Record<number, any>>({});
    const [videoModalVisible, setVideoModalVisible] = useState(false);
    const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);

    // 加载订阅信息
    useEffect(() => {
        if (!session?.user?.id) return;

        const load = async () => {
            try {
                setLoading(true);
                const res = await subscriptionService.getCoachSubscriptions({
                    studentId: session.user.id,
                });

                if (res) {
                    setSubscriptions(res.subscriptions);
                    if (res.subscriptions.length > 0) {
                        setActiveSubscriptionId(res.subscriptions[0].id);
                    }
                }
            } catch (e) {
                setSubscriptions([]);
                showToast({
                    severity: 'error',
                    summary: '加载失败',
                    detail: '无法加载订阅信息，请稍后重试',
                });
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [session?.user?.id]);

    // 加载计划实例和动作详情
    useEffect(() => {
        if (!subscriptions.length || !activeSubscriptionId) return;

        const loadInstance = async () => {
            setInstanceLoading(prev => ({ ...prev, [activeSubscriptionId]: true }));

            try {
                const res = await planLibService.getInstance({
                    subscriptionId: activeSubscriptionId
                });

                if (res && res.instance) {
                    setInstances(prev => ({ ...prev, [activeSubscriptionId]: res.instance }));

                    // 使用 API 返回的 actions
                    if (res.actions) {
                        setActions(prev => ({ ...prev, ...res.actions }));
                    }

                    // 加载执行数据
                    const exeRes = await planLibService.getWithExecutions({ subscriptionId: activeSubscriptionId });
                    if (exeRes) {
                        setExecutions(exeRes.executions);
                    }
                }

            } catch (error) {
                setInstances(prev => ({ ...prev, [activeSubscriptionId]: null }));
            } finally {
                setInstanceLoading(prev => ({ ...prev, [activeSubscriptionId]: false }));
            }
        };

        loadInstance();
    }, [activeSubscriptionId, subscriptions.length]);

    // 获取状态对应的颜色和标签
    const getStatusConfig = (status?: string) => {
        const config = {
            active: { color: 'success', label: '进行中', icon: 'pi pi-play' },
            draft: { color: 'warning', label: '草稿', icon: 'pi pi-file-edit' },
            completed: { color: 'info', label: '已完成', icon: 'pi pi-check-circle' },
            paused: { color: 'secondary', label: '已暂停', icon: 'pi pi-pause' },
            archived: { color: 'contrast', label: '已归档', icon: 'pi pi-archive' }
        };
        return config[status as keyof typeof config] || { color: 'surface', label: status || '未知', icon: 'pi pi-question-circle' };
    };

    // 获取星期名称
    const getDayName = (dayIndex: number) => {
        const days = ['', '第1天', '第2天', '第3天', '第4天', '第5天', '第6天', '第7天'];
        return days[dayIndex] || `第${dayIndex}天`;
    };

    // 计算训练日期（从今天开始）
    const getTrainingDate = (dayIndex: number) => {
        const today = new Date();
        const trainingDate = new Date(today);
        trainingDate.setDate(today.getDate() + (dayIndex - 1));
        return trainingDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' });
    };

    // 骨架屏
    const SkeletonTabs = () => (
        <div className="min-h-screen bg-surface-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Skeleton width="250px" height="48px" className="mb-8 rounded-lg" />
                <div className="space-y-8">
                    <div className="flex flex-wrap gap-4 mb-8">
                        {[1, 2, 3].map(i => (
                            <Skeleton key={i} width="120px" height="44px" className="rounded-full" />
                        ))}
                    </div>
                    <Card className='shadow-sm'>
                        <Skeleton width="60%" height="32px" className="mb-4" />
                        <Skeleton width="100%" height="16px" className="mb-2" />
                        <Skeleton width="80%" height="16px" className="mb-6" />
                        <div className="grid grid-cols-2 gap-4">
                            <Skeleton height="100px" className="rounded-lg" />
                            <Skeleton height="100px" className="rounded-lg" />
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );

    // 空状态
    const EmptyState = () => (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <Card>
                <div className="text-center py-12">
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i className="pi pi-user-plus text-3xl text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold text-surface-900 mb-3">
                        开始您的健身之旅
                    </h3>
                    <p className="text-surface-600 dark:text-surface-400 mb-8 max-w-md mx-auto text-lg">
                        订阅专业教练，获取个性化的训练计划，实现您的健身目标
                    </p>
                    <Button
                        label="探索教练"
                        icon="pi pi-arrow-right"
                        className="px-8 py-3 text-lg rounded-full"
                        onClick={() => window.location.href = '/coach/discovery'}
                    />
                </div>
            </Card>
        </div>
    );

    // 无计划状态
    const NoPlanState = () => {
        const activeCoach = subscriptions.find(s => s.id === activeSubscriptionId)?.coach;
        const coachName = activeCoach?.name || '教练';

        return (
            <div>
                <div className="text-center py-12">
                    <div className="w-20 h-20 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i className="pi pi-clock text-3xl text-warning" />
                    </div>
                    <h3 className="text-2xl font-bold text-surface-900 mb-3">
                        计划制定中
                    </h3>
                    <p className="text-surface-600 mb-6 max-w-md mx-auto text-lg">
                        {coachName}正在为您制定专属训练计划
                    </p>
                    <div className="inline-flex items-center gap-3 px-4 py-2 bg-surface-200 rounded-full">
                        <i className="pi pi-spin pi-spinner text-surface-500" />
                        <span className="text-surface-600">请耐心等待...</span>
                    </div>
                </div>
            </div>
        );
    };

    // 动作项显示组件
    const ActionItem = ({ actionSet, action }: { actionSet: CoachPlanAction; action?: any }) => {
        const actionName = action?.name || actionSet.set_name || '未知动作';
        const hasVideo = !!action?.url; // url 是视频链接字段
        const actionDetail = action?.detail; // detail 是动作说明字段

        return (
            <div className="flex items-center justify-between py-3 px-4 bg-surface-50 rounded-lg hover:bg-surface-100 transition-colors">
                <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center gap-2 text-surface-500">
                        <i className="pi pi-th-large text-sm" />
                        <span className="text-sm">{(actionSet as any).params?.['组数'] || actionSet.sets}组×{(actionSet as any).params?.['次数'] || actionSet.reps}次</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <i className="pi pi-box text-sm text-surface-500" />
                        <span className="font-medium text-surface-900">{actionName}</span>
                    </div>
                    {/* 强度显示：优先显示计算后的重量，否则显示RM */}
                    {(() => {
                        const params = (actionSet as any).params || {};
                        const load = params.load;
                        const intensity = params['强度'] || actionSet.intensity;
                        
                        if (load && load > 0) {
                            // 显示自动计算的具体重量
                            return (
                                <div className="flex items-center gap-1 text-green-600">
                                    <span className="text-sm">💪 {load}kg</span>
                                </div>
                            );
                        } else if (intensity) {
                            // 显示RM强度
                            return (
                                <div className="flex items-center gap-1 text-surface-600">
                                    <span className="text-sm">💪 {intensity}RM</span>
                                </div>
                            );
                        }
                        return null;
                    })()}
                    {((actionSet as any).params?.['休息时间'] || actionSet.rest_seconds) && (
                        <div className="flex items-center gap-1 text-surface-500">
                            <i className="pi pi-clock text-xs" />
                            <span className="text-sm">休息{(actionSet as any).params?.['休息时间'] || actionSet.rest_seconds}秒</span>
                        </div>
                    )}
                </div>
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

    // 训练日卡片
    const TrainingDayCard = ({ day }: { day: CoachPlanTrainingDay }) => {
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
                        // 支持两种字段名: action_id 和 actionId
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

    // 计划详情卡片
    const PlanDetailCard = ({ instance }: { instance: CoachPlanInstanceRow }) => {
        const statusConfig = getStatusConfig(instance.status);
        const trainingDays = (instance.training_days as unknown as TrainingDay[] || [])
            .sort((a, b) => a.dayIndex - b.dayIndex);

        return (
            <div className="space-y-6">
                {/* 计划标题和状态 */}
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-2xl font-bold text-surface-900">
                                {instance.name || '训练计划'}
                            </h2>
                            <Badge
                                value={statusConfig.label}
                                severity={statusConfig.color as any}
                                className="rounded-full px-3 py-1"
                            />
                        </div>
                        <p className="text-surface-600 text-lg leading-relaxed">
                            {instance.description || '暂无描述'}
                        </p>
                    </div>
                </div>

                {/* 计划统计 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-surface-50 border-0">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                                <i className="pi pi-calendar text-xl text-primary" />
                            </div>
                            <div>
                                <p className="text-sm text-surface-500 mb-1">创建时间</p>
                                <p className="font-semibold">
                                    {instance.created_at ? new Date(instance.created_at).toLocaleDateString() : '--'}
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card className="bg-surface-50 border-0">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                                <i className="pi pi-chart-line text-xl text-success" />
                            </div>
                            <div>
                                <p className="text-sm text-surface-500 mb-1">训练天数</p>
                                <p className="font-semibold">
                                    {trainingDays.filter(d => d.type === 'training').length} 天
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card className="bg-surface-50 border-0">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center">
                                <i className="pi pi-list text-xl text-info" />
                            </div>
                            <div>
                                <p className="text-sm text-surface-500 mb-1">总动作数</p>
                                <p className="font-semibold">
                                    {trainingDays.reduce((sum, day) => sum + (day.actionSets?.length || 0), 0)} 个
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* 快速操作 */}
                <div className="flex flex-wrap gap-3 pt-4 border-t border-surface-200">
                    <Button
                        label="开始训练"
                        icon="pi pi-play"
                        className="rounded-full"
                        disabled={instance.status !== 'active'}
                    />
                    <Button
                        label="查看进度"
                        icon="pi pi-chart-bar"
                        className="rounded-full"
                        outlined
                    />
                    <Button
                        label="分享计划"
                        icon="pi pi-share-alt"
                        className="rounded-full"
                        outlined
                    />
                </div>

                <Divider />

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
            </div>
        );
    };

    return (
        <div className="min-h-screen transition-colors duration-200">
            {loading ? (
                <SkeletonTabs />
            ) : subscriptions.length === 0 ? (
                <EmptyState />
            ) : (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* 教练选择区域 */}
                    <Card className="mb-8 border-0 shadow-sm">
                        <div className="mb-4 flex items-center gap-2">
                            <i className="pi pi-users text-primary" />
                            <span className="font-semibold text-surface-700">
                                已订阅教练 ({subscriptions.length})
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {subscriptions.map((subscription) => {
                                const isActive = activeSubscriptionId === subscription.id;
                                return (
                                    <button
                                        key={subscription.id}
                                        className={`group relative px-5 py-3 rounded-xl transition-all duration-300 flex items-center gap-3 ${isActive
                                            ? 'bg-gradient-to-r from-primary to-primary-600 text-surface shadow-lg shadow-primary/20'
                                            : 'bg-surface text-surface-700 border border-surface-200 hover:shadow-md'
                                            }`}
                                        onClick={() => setActiveSubscriptionId(subscription.id)}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive
                                            ? 'bg-surface/20'
                                            : 'bg-surface-100'
                                            }`}>
                                            <i className={`pi pi-user ${isActive ? 'text-surface' : 'text-surface-500'}`} />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-medium">
                                                {subscription.coach?.name || `教练${subscription.id.substring(0, 8)}`}
                                            </div>
                                            <div className={`text-xs ${isActive ? 'text-surface/80' : 'text-surface-500'}`}>
                                                {subscription.coach?.specialization || '专业健身教练'}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </Card>

                    {/* 计划详情区域 */}
                    <Card className='shadow-sm mb-6'>
                        <div className="p-6">
                            {activeSubscriptionId && (
                                <>
                                    {instanceLoading[activeSubscriptionId] ? (
                                        <div className="flex justify-center items-center h-64">
                                            <div className="text-center">
                                                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <i className="pi pi-spin pi-spinner text-2xl text-primary" />
                                                </div>
                                                <p className="text-surface-600 dark:text-surface-400">
                                                    加载计划信息中...
                                                </p>
                                            </div>
                                        </div>
                                    ) : instances[activeSubscriptionId] ? (
                                        <PlanDetailCard instance={instances[activeSubscriptionId]!} />
                                    ) : (
                                        <NoPlanState />
                                    )}
                                </>
                            )}
                        </div>
                    </Card>
                </div>
            )}

            {/* Video Modal */}
            <Dialog
                visible={videoModalVisible}
                onHide={() => {
                    setVideoModalVisible(false);
                    setCurrentVideoUrl(null);
                }}
                header="查看视频"
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

export default TrainingPlansHome;