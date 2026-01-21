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
import { calculateCurrentWeek, isDayUnlocked, getDayWeekNumber, formatUnlockDate, getUnlockDate } from '@/lib/weekUnlock';

const TrainingPlansHome: React.FC = () => {
    const { data: session } = useSession();
    const { showToast } = useToastContext();

    const [subscriptions, setSubscriptions] = useState<QueryCoachSubscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSubscriptionId, setActiveSubscriptionId] = useState<string | null>(null);
    const [instances, setInstances] = useState<Record<string, CoachPlanInstanceRow | null>>({});
    const [instanceLoading, setInstanceLoading] = useState<Record<string, boolean>>({});
    const [actions, setActions] = useState<Record<string, CoachActionRow>>({});
    // 避免“自建计划”和“教练计划”执行记录互相污染：分别维护
    const [coachExecutionsByDayIndex, setCoachExecutionsByDayIndex] = useState<Record<number, any>>({});
    const [selfExecutionsByDayIndex, setSelfExecutionsByDayIndex] = useState<Record<number, any>>({});
    const [videoModalVisible, setVideoModalVisible] = useState(false);
    const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
    // 当前执行天数（用于计算日期）
    const [currentDayIndex, setCurrentDayIndex] = useState<number>(1);
    // 自建计划支持
    const [selfPlan, setSelfPlan] = useState<CoachPlanInstanceRow | null>(null);
    const [selfPlanLoading, setSelfPlanLoading] = useState(false);
    const [selfPlanActions, setSelfPlanActions] = useState<Record<string, CoachActionRow>>({});
    // 计划显示模式: 'coach' | 'self'
    const [planMode, setPlanMode] = useState<'coach' | 'self'>('coach');

    // 加载订阅信息
    useEffect(() => {
        if (!session?.user?.id) return;

        const load = async () => {
            try {
                setLoading(true);
                const res = await subscriptionService.getCoachSubscriptions({
                    studentId: session.user.id,
                    computePauseAwareEndDate: false,
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

    // 加载自建计划（总是加载，不仅仅在没有订阅时）
    useEffect(() => {
        if (loading) return;
        if (!session?.user?.id) return;

        const loadSelfPlan = async () => {
            setSelfPlanLoading(true);
            try {
                const res = await planLibService.getInstance({ fetchSelf: true });
                if (res?.instance) {
                    setSelfPlan(res.instance);
                    if (res.actions) {
                        setSelfPlanActions(res.actions);
                    }

                    // executions + nextDayIndex: prefer get-instance derived fields (fast path)
                    if ((res as any).executionsByDayIndex) {
                        setSelfExecutionsByDayIndex((res as any).executionsByDayIndex || {});
                    } else {
                        // fallback: legacy API
                        try {
                            const exeRes = await planLibService.getWithExecutions({ instanceId: res.instance.id });
                            if (exeRes) {
                                setSelfExecutionsByDayIndex(exeRes.executions || {});
                            }
                        } catch (e) {
                            console.error('Failed to load self plan executions:', e);
                        }
                    }

                    if (typeof ((res as any).recommendedDayIndex ?? (res as any).nextDayIndex) === 'number') {
                        setCurrentDayIndex((res as any).recommendedDayIndex ?? (res as any).nextDayIndex);
                    } else {
                        // fallback: legacy API
                        try {
                            const nextDayRes = await fetch(`/api/execution/get-next-training-day?instanceId=${res.instance.id}`);
                            const nextDayData = await nextDayRes.json();
                            if (nextDayData.success && nextDayData.data) {
                                setCurrentDayIndex(nextDayData.data.nextDayIndex);
                            }
                        } catch (e) {
                            const startDay = (res.instance as any).start_execution_day || 1;
                            setCurrentDayIndex(startDay);
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to load self plan:', e);
            } finally {
                setSelfPlanLoading(false);
            }
        };

        loadSelfPlan();
    }, [loading, session?.user?.id]);

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

                    // executions + nextDayIndex: prefer get-instance derived fields (fast path)
                    if ((res as any).executionsByDayIndex) {
                        setCoachExecutionsByDayIndex((res as any).executionsByDayIndex || {});
                    } else {
                        const exeRes = await planLibService.getWithExecutions({ subscriptionId: activeSubscriptionId });
                        if (exeRes) {
                            setCoachExecutionsByDayIndex(exeRes.executions || {});
                        }
                    }

                    if (typeof ((res as any).recommendedDayIndex ?? (res as any).nextDayIndex) === 'number') {
                        setCurrentDayIndex((res as any).recommendedDayIndex ?? (res as any).nextDayIndex);
                    } else {
                        try {
                            const nextDayRes = await fetch(`/api/execution/get-next-training-day?instanceId=${res.instance.id}`);
                            const nextDayData = await nextDayRes.json();
                            if (nextDayData.success && nextDayData.data) {
                                setCurrentDayIndex(nextDayData.data.nextDayIndex);
                            }
                        } catch (e) {
                            // 默认使用起始执行天 或 day 1
                            const startDay = (res.instance as any).start_execution_day || 1;
                            setCurrentDayIndex(startDay);
                        }
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

    // 计算“计划日历日期”：统一用 start_date + dayIndex 计算（避免延迟完成导致日期顺延/错乱）
    const getActualDateLabel = (execution: any): string | null => {
        if (!execution) return null;
        const ts = execution.status === 'completed'
            ? execution.completed_at
            : execution.status === 'in_progress'
                ? execution.started_at
                : null;
        if (!ts) return null;
        const dt = new Date(ts);
        return dt.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' });
    };

    const getPlannedDateLabelByAnchor = (dayIndex: number, executionsByDayIndex: Record<number, any>) => {
        const execs = executionsByDayIndex || {};
        const resolved = Object.values(execs).filter((e: any) =>
            (e?.status === 'completed' || e?.status === 'abandoned') && (e?.completed_at || e?.started_at)
        ) as any[];
        if (resolved.length === 0) return null;
        const maxResolved = Math.max(...resolved.map((e) => Number(e?.day_index ?? 0)).filter(Boolean));
        if (!maxResolved || dayIndex <= maxResolved) return null;
        const anchorExec = (execs as any)[maxResolved];
        const anchorTs = anchorExec?.completed_at || anchorExec?.started_at;
        if (!anchorTs) return null;
        const anchor = new Date(anchorTs);
        anchor.setHours(0, 0, 0, 0);
        const target = new Date(anchor);
        target.setDate(anchor.getDate() + (dayIndex - maxResolved));
        return target.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' });
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

    const PlanDetailSkeleton = () => (
        <div className="space-y-8 animate-pulse">
            <div className="flex justify-between items-start">
                <div className="space-y-3 flex-1">
                    <Skeleton width="40%" height="2rem" borderRadius="10px" />
                    <Skeleton width="90%" height="1.2rem" />
                </div>
                <Skeleton width="6rem" height="2rem" borderRadius="20px" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Skeleton height="80px" borderRadius="16px" />
                <Skeleton height="80px" borderRadius="16px" />
                <Skeleton height="80px" borderRadius="16px" />
            </div>
            <div className="space-y-4 pt-6 border-t border-surface-200">
                <Skeleton width="150px" height="1.5rem" className="mb-4" />
                {[1, 2].map(i => <Skeleton key={i} height="120px" borderRadius="16px" />)}
            </div>
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
        // 支持多种字段名: actionName, set_name
        const actionName = action?.name || (actionSet as any).actionName || actionSet.set_name || '未知动作';
        const hasVideo = !!action?.url; // url 是视频链接字段
        const actionDetail = action?.detail; // detail 是动作说明字段
        
        // 获取动作类型
        const itemType = (actionSet as any).itemType || action?.type || 'STRENGTH';
        const params = (actionSet as any).params || {};
        const customData = params.custom_data || {};

        // 根据类型渲染不同的摘要信息
        const renderPills = () => {
            switch (itemType) {
                case 'DIET':
                    return (
                        <>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[11px] font-bold">
                                🥗 饮食建议
                            </span>
                            {params.suggested_time && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-100 text-surface-600 text-[11px] font-bold">
                                    ⏰ {params.suggested_time}
                                </span>
                            )}
                        </>
                    );
                case 'CARDIO':
                    return (
                        <>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold">
                                🏃 有氧
                            </span>
                            {customData.duration ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-100 text-surface-600 text-[11px] font-bold">
                                    ⏱ {(customData.duration / 60).toFixed(0)}分钟
                                </span>
                            ) : null}
                            {customData.distance ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-100 text-surface-600 text-[11px] font-bold">
                                    📏 {(customData.distance / 1000).toFixed(1)}km
                                </span>
                            ) : null}
                        </>
                    );
                case 'HABIT':
                    return (
                        <>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[11px] font-bold">
                                ✅ 习惯
                            </span>
                            {customData.target_duration && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-100 text-surface-600 text-[11px] font-bold">
                                    ⏱ {customData.target_duration}分钟
                                </span>
                            )}
                        </>
                    );
                case 'STRENGTH':
                default:
                    const sets = params['组数'] || (actionSet as any).sets || 1;
                    const reps = params['次数'] || (actionSet as any).reps || 1;
                    const load = params.load;
                    const intensity = params['强度'] || (actionSet as any).intensity;
                    const restSec = params['休息时间'] || (actionSet as any).rest_seconds || 0;

                    return (
                        <>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-100 text-surface-700 text-[11px] font-bold">
                                ▦ {sets}×{reps}
                            </span>
                            {typeof load === 'number' ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                    load < 0 ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                                }`}>
                                    💪 {load < 0 ? `辅助 ${Math.abs(load)}kg` : `${load}kg`}
                                </span>
                            ) : intensity ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-100 text-surface-600 text-[11px] font-bold">
                                    💪 {intensity}RM
                                </span>
                            ) : null}
                            {restSec > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-100 text-surface-600 text-[11px] font-bold">
                                    ⏱ {((restSec) / 60).toFixed(1)}分
                                </span>
                            )}
                        </>
                    );
            }
        };

        const note = params.note;

        return (
            <div className="rounded-xl border border-surface-100 bg-white/60 px-3 py-2 hover:bg-white transition-colors">
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-surface-100 flex items-center justify-center shrink-0">
                        <i className="pi pi-box text-[12px] text-surface-500" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <div className="font-black text-surface-900 truncate">{actionName}</div>
                            <div className="flex items-center gap-1 shrink-0">
                                {hasVideo && (
                                    <Button
                                        icon="pi pi-video"
                                        text
                                        rounded
                                        size="small"
                                        className="w-8 h-8 rounded-xl text-primary hover:bg-primary-50"
                                        aria-label="查看动作视频"
                                        onClick={() => window.open(action?.url, '_blank')}
                                    />
                                )}
                                {actionDetail && (
                                    <Button
                                        icon="pi pi-info-circle"
                                        text
                                        rounded
                                        size="small"
                                        className="w-8 h-8 rounded-xl text-surface-500 hover:bg-surface-100"
                                        aria-label="查看动作说明"
                                        tooltip={actionDetail}
                                        tooltipOptions={{ position: 'left' }}
                                    />
                                )}
                            </div>
                        </div>

                        <div className="mt-1 flex flex-wrap gap-1.5">
                            {renderPills()}
                            {itemType !== 'STRENGTH' && (customData.content || customData.habit_name || action?.detail) && (
                                <span className="inline-flex items-center max-w-full gap-1 px-2 py-0.5 rounded-full bg-surface-100 text-surface-600 text-[11px] font-bold truncate">
                                    {String(customData.content || customData.habit_name || action?.detail)}
                                </span>
                            )}
                        </div>

                        {note && (
                            <div className="mt-2 flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg w-full">
                                <i className="pi pi-info-circle text-[11px]" />
                                <span className="line-clamp-2">{note}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // 执行详情组件 - 可折叠版本
    const ExecutionDetailsSection = ({ execution }: { execution: any }) => {
        const [collapsed, setCollapsed] = useState(true);
        
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
                    className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 mb-3 border border-green-200 cursor-pointer select-none hover:bg-green-100 transition-colors"
                    onClick={() => setCollapsed(!collapsed)}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-green-700 flex items-center gap-2">
                            <i className="pi pi-check-circle" />
                            学员执行情况
                            <span className="ml-2 text-green-600 font-normal">
                                ({completedSets.length} 组)
                            </span>
                        </span>
                        <i className={`pi ${collapsed ? 'pi-chevron-down' : 'pi-chevron-up'} text-green-600 transition-transform`} />
                    </div>
                </div>
                
                {/* 执行记录表格 - 折叠时隐藏 */}
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
                )}
            </div>
        );
    };

    // 训练日卡片
    const TrainingDayCard = ({ day, startDate, unlockedWeek }: { day: CoachPlanTrainingDay; startDate?: string | Date | null; unlockedWeek: number }) => {
        const isRestDay = day.type === 'rest';
        const actionSets = day.actionSets || [];
        const executionsByDayIndex = planMode === 'coach' ? coachExecutionsByDayIndex : selfExecutionsByDayIndex;
        const dayExecution = executionsByDayIndex[day.dayIndex];
        const planned = !dayExecution ? getPlannedDateLabelByAnchor(day.dayIndex, executionsByDayIndex) : null;
        
        // 🔒 检查该天是否已解锁
        const isUnlocked = isDayUnlocked(day.dayIndex, unlockedWeek);
        const weekNumber = getDayWeekNumber(day.dayIndex);

        // 📝 制定中状态卡片
        if (!isUnlocked) {
            return (
                <div className="border border-amber-100 rounded-xl p-4 bg-amber-50/30 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-50/80 to-amber-50/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                <i className="pi pi-pencil text-amber-500" />
                            </div>
                            <p className="text-sm font-medium text-amber-600">第 {weekNumber} 周 · 制定中</p>
                            <p className="text-xs text-amber-400">
                                {(() => {
                                    const unlockDate = getUnlockDate(weekNumber, startDate);
                                    if (unlockDate) {
                                        return `预计 ${formatUnlockDate(unlockDate)} 发布`;
                                    }
                                    return '教练精心准备中';
                                })()}
                            </p>
                        </div>
                    </div>
                    {/* 模糊的背景内容 */}
                    <div className="opacity-30 filter blur-[1px] pointer-events-none">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-surface-200 rounded-full flex items-center justify-center">
                                <i className={`pi ${isRestDay ? 'pi-moon' : 'pi-bolt'} text-surface-400`} />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-semibold text-surface-600">{getDayName(day.dayIndex)}</h4>
                                <p className="text-sm text-surface-400">
                                    {isRestDay ? '休息日' : `${actionSets.length} 个动作`}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (isRestDay) {
            return (
                <div className="border border-surface-200 rounded-xl p-4 bg-surface-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <i className="pi pi-moon text-blue-600" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-semibold text-surface-900">{getDayName(day.dayIndex)}</h4>
                            <p className="text-sm text-surface-500">
                                休息日{planned ? ` · 预计 ${planned}` : ''}
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        // Mobile: 默认折叠（像 App），当前执行日默认展开
        const defaultOpen = day.dayIndex === currentDayIndex;

        return (
            <details className="group border border-surface-200 rounded-2xl overflow-hidden bg-surface" open={defaultOpen}>
                {/* 训练日头部 */}
                <summary className="list-none cursor-pointer select-none">
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/5 to-primary/10 border-b border-surface-200 gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 bg-primary/20 rounded-2xl flex items-center justify-center shrink-0 border border-primary/20">
                                <i className="pi pi-bolt text-primary" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                    <h4 className="font-black text-surface-900 whitespace-nowrap">{getDayName(day.dayIndex)}</h4>
                                    {dayExecution?.status === 'completed' && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-bold">
                                            已完成
                                        </span>
                                    )}
                                    {dayExecution?.status === 'in_progress' && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-[11px] font-bold">
                                            进行中
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-surface-600 truncate">
                                    {dayExecution?.status === 'completed' && getActualDateLabel(dayExecution)
                                        ? `完成于 ${getActualDateLabel(dayExecution)} · `
                                        : dayExecution?.status === 'in_progress' && getActualDateLabel(dayExecution)
                                            ? `开始于 ${getActualDateLabel(dayExecution)} · `
                                            : planned
                                                ? `预计 ${planned} · `
                                                : ''}{actionSets.length} 个动作
                                </p>
                                {/* 折叠态预览：直接给出动作名（更像 App 列表） */}
                                <p className="mt-1 text-[11px] text-surface-500 truncate">
                                    {actionSets.slice(0, 3).map((as: any) => {
                                        const actionId = as.action_id || as.actionId;
                                        return actions[actionId]?.name || as.actionName || as.set_name || '动作';
                                    }).join(' · ')}
                                    {actionSets.length > 3 ? ' · …' : ''}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary-50 border border-primary-100 text-primary-700 text-[11px] font-bold">
                                训练日
                            </span>
                            <i className="pi pi-chevron-right text-surface-300 transition-transform duration-200 group-open:rotate-90" />
                        </div>
                    </div>
                </summary>

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
            </details>
        );
    };

    // 计划详情卡片
    const PlanDetailCard = ({ instance }: { instance: CoachPlanInstanceRow }) => {
        const statusConfig = getStatusConfig(instance.status);
        const trainingDays = (instance.training_days as unknown as CoachPlanTrainingDay[] || [])
            .sort((a, b) => a.dayIndex - b.dayIndex);
        
        // 🔒 计算已解锁的周次
        const startExecutionDay = (instance as any).start_execution_day || 1;
        const unlockedWeek = Math.max(
            calculateCurrentWeek(instance.start_date),
            getDayWeekNumber(startExecutionDay),
        );

        return (
            <div className="space-y-8">
                {/* 标题区域：增加渐变装饰 */}
                <div className="relative group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <h2 className="text-3xl font-extrabold text-surface-900 tracking-tight">
                                    {instance.name || '定制训练计划'}
                                </h2>
                                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ring-1 ring-inset ${instance.status === 'active'
                                        ? 'bg-green-50 text-green-700 ring-green-600/20'
                                        : 'bg-surface-100 text-surface-600 ring-surface-500/10'
                                    }`}>
                                    <span className={`w-2 h-2 rounded-full ${instance.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-surface-400'}`} />
                                    {statusConfig.label}
                                </span>
                            </div>
                            <p className="text-surface-500 text-lg max-w-2xl leading-relaxed">
                                {instance.description || '这是教练为您量身打造的阶段性训练目标。'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 统计卡片：增加毛玻璃与悬浮效果 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        { label: '创建时间', value: new Date(instance.created_at!).toLocaleDateString(), icon: 'pi-calendar', color: 'text-blue-500', bg: 'bg-blue-50' },
                        { label: '训练频率', value: `${trainingDays.filter(d => d.type === 'training').length}天/周期`, icon: 'pi-bolt', color: 'text-amber-500', bg: 'bg-amber-50' },
                        { label: '动作总数', value: `${trainingDays.reduce((sum, day) => sum + (day.actionSets?.length || 0), 0)}项`, icon: 'pi-list', color: 'text-purple-500', bg: 'bg-purple-50' }
                    ].map((stat, i) => (
                        <div key={i} className="flex items-center p-4 rounded-2xl border border-surface-100 bg-surface-0/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center mr-4 text-xl`}>
                                <i className={`pi ${stat.icon}`} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-surface-400 uppercase tracking-wider">{stat.label}</p>
                                <p className="text-lg font-bold text-surface-900">{stat.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-3">
                    <Button label="开始今日训练" icon="pi pi-play" className="p-button-raised p-button-rounded px-6 py-3 font-bold transition-transform active:scale-95" disabled={instance.status !== 'active'} onClick={() => window.location.href = '/today-training'} />
                    <Button label="趋势分析" icon="pi pi-chart-line" className="p-button-text p-button-rounded font-semibold" />
                </div>

                <Divider className="my-8" />

                {/* 训练安排：更现代的列表样式 */}
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-surface-800 flex items-center gap-2">
                            <i className="pi pi-calendar-clock text-primary text-2xl" />
                            训练安排
                            {/* 🔒 显示当前解锁周次 */}
                            <span className="text-sm font-normal text-surface-400 ml-2">
                                已解锁: 第 {unlockedWeek} 周
                            </span>
                        </h3>
                        <span className="text-sm text-surface-400 font-medium">共 {trainingDays.length} 天计划</span>
                    </div>
                    <div className="grid gap-6">
                        {trainingDays.map((day, idx) => (
                            <TrainingDayCard 
                                key={idx} 
                                day={day} 
                                startDate={instance.start_date}
                                unlockedWeek={unlockedWeek}
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen transition-colors duration-200">
            {loading || selfPlanLoading ? (
                <SkeletonTabs />
            ) : subscriptions.length === 0 && !selfPlan ? (
                <EmptyState />
            ) : (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* 计划类型切换器 (当同时有教练计划和自建计划时显示) */}
                    {subscriptions.length > 0 && selfPlan && (
                        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-6 w-fit">
                            <button
                                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                                    planMode === 'coach'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                                onClick={() => setPlanMode('coach')}
                            >
                                <i className="pi pi-user" />
                                教练计划
                            </button>
                            <button
                                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                                    planMode === 'self'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                                onClick={() => setPlanMode('self')}
                            >
                                <i className="pi pi-star" />
                                我的计划
                            </button>
                        </div>
                    )}

                    {/* 教练计划模式 */}
                    {planMode === 'coach' && subscriptions.length > 0 && (
                        <>
                            {/* 如果有订阅，显示教练选择区域 */}
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
                                                        {(subscription.coach as any)?.specialization || '专业健身教练'}
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
                                                <PlanDetailSkeleton />
                                            ) : instances[activeSubscriptionId] ? (
                                                <PlanDetailCard instance={instances[activeSubscriptionId]!} />
                                            ) : (
                                                <NoPlanState />
                                            )}
                                        </>
                                    )}
                                </div>
                            </Card>
                        </>
                    )}

                    {/* 自建计划模式 */}
                    {((planMode === 'self' && selfPlan) || (subscriptions.length === 0 && selfPlan)) && (
                        <>
                            {/* 自建计划头部 */}
                            <Card className="mb-8 border-0 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                                        <i className="pi pi-star text-white text-xl" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-surface-900">我的自建计划</h2>
                                        <p className="text-sm text-surface-500">自我驱动，超越极限</p>
                                    </div>
                                </div>
                            </Card>

                            {/* 自建计划详情 */}
                            <Card className='shadow-sm mb-6'>
                                <div className="p-6">
                                    <PlanDetailCard instance={selfPlan} />
                                </div>
                            </Card>
                        </>
                    )}
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