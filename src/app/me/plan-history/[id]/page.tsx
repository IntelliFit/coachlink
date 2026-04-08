'use client';

import React, { useState, useEffect } from 'react';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Tag } from 'primereact/tag';
import { Skeleton } from 'primereact/skeleton';
import { useRouter, useParams } from 'next/navigation';
import { TrainingDayCard } from '@/components/plan/TrainingDayCard';
import { planLibService } from '@/app/service/planLibService';
import { calculateCurrentWeek, isDayUnlocked, getDayWeekNumber, formatUnlockDate, getUnlockDate } from '@/lib/weekUnlock';

interface PlanInstance {
    id: string;
    name: string;
    description: string | null;
    source: string | null;
    status: string;
    start_date: string | null;
    end_date: string | null;
    start_execution_day?: number | null;
    training_days: any[];
    created_at: string;
    updated_at: string;
}

export default function PlanHistoryDetailPage() {
    const router = useRouter();
    const params = useParams();
    const instanceId = params.id as string;

    const [instance, setInstance] = useState<PlanInstance | null>(null);
    const [executions, setExecutions] = useState<Record<number, any>>({});
    const [actions, setActions] = useState<Record<string, any>>({});
    const [derivedStatus, setDerivedStatus] = useState<string | null>(null);
    const [isLogicallyCompleted, setIsLogicallyCompleted] = useState(false);
    const [trainingProgress, setTrainingProgress] = useState({
        resolved: 0,
        total: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (instanceId) {
            fetchPlanDetail();
        }
    }, [instanceId]);

    const fetchPlanDetail = async () => {
        setLoading(true);
        setDerivedStatus(null);
        setIsLogicallyCompleted(false);
        setTrainingProgress({ resolved: 0, total: 0 });
        try {
            // 获取计划实例详情（带动作信息）
            const res = await planLibService.getInstance({ id: instanceId });
            
            if (res?.instance) {
                setInstance(res.instance);
                setDerivedStatus(typeof (res as any)?.derivedStatus === 'string'
                    ? (res as any).derivedStatus
                    : null);
                const totalTrainingDays = Number((res as any)?.totalTrainingDays || 0);
                const resolvedCount = Array.isArray((res as any)?.resolvedDays)
                    ? (res as any).resolvedDays.length
                    : 0;
                const completedCount = Array.isArray((res as any)?.completedDays)
                    ? (res as any).completedDays.length
                    : 0;
                const logicallyCompletedFromCounts = totalTrainingDays > 0 &&
                    Math.max(resolvedCount, completedCount) >= totalTrainingDays;
                setIsLogicallyCompleted(
                    Boolean((res as any)?.isLogicallyCompleted) ||
                        logicallyCompletedFromCounts,
                );
                setTrainingProgress({
                    resolved: Math.max(resolvedCount, completedCount),
                    total: totalTrainingDays,
                });
                
                // 设置动作信息
                if (res.actions) {
                    setActions(res.actions);
                }

                // 加载执行记录 - 和训练计划页面一样使用 getWithExecutions
                const exeRes = await planLibService.getWithExecutions({ instanceId });
                if (exeRes?.executions) {
                    setExecutions(exeRes.executions);
                }
            }
        } catch (error) {
            console.error('获取计划详情失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusTag = (status: string) => {
        switch (status) {
            case 'active':
                return <Tag severity="success" value="进行中" icon="pi pi-play" />;
            case 'completed':
                return <Tag severity="info" value="已完成" icon="pi pi-check" />;
            case 'archived':
                return <Tag severity="warning" value="已归档" />;
            default:
                return <Tag value={status} />;
        }
    };

    const getSourceTag = (source: string | null) => {
        if (source === 'coach') {
            return <Tag severity="info" value="教练指派" icon="pi pi-user" />;
        }
        return <Tag severity="secondary" value="我的计划" icon="pi pi-star" />;
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const getDayName = (dayIndex: number) => {
        return `第${dayIndex}天`;
    };

    const getTrainingDate = (dayIndex: number) => {
        if (!instance?.start_date) return '';
        const startDate = new Date(instance.start_date);
        startDate.setHours(0, 0, 0, 0);
        const targetDate = new Date(startDate);
        targetDate.setDate(startDate.getDate() + dayIndex - 1);
        return `${targetDate.getMonth() + 1}月${targetDate.getDate()}日`;
    };

    if (loading) {
        return (
            <div className="p-4 max-w-4xl mx-auto">
                <Skeleton height="2rem" width="60%" className="mb-4" />
                <Skeleton height="1rem" width="40%" className="mb-6" />
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} height="10rem" width="100%" />
                    ))}
                </div>
            </div>
        );
    }

    if (!instance) {
        return (
            <div className="p-4 max-w-4xl mx-auto text-center py-12">
                <i className="pi pi-exclamation-circle text-4xl text-gray-300 mb-4" />
                <h3 className="text-xl font-medium text-gray-600 mb-2">计划不存在</h3>
                <Button label="返回" icon="pi pi-arrow-left" onClick={() => router.back()} />
            </div>
        );
    }

    const totalDays = instance.training_days?.length || 0;
    const legacyResolvedDays = Object.values(executions).filter((exec: any) =>
        exec?.status === 'completed' || exec?.status === 'abandoned'
    ).length;
    const completionRate = trainingProgress.total > 0
        ? Math.round((trainingProgress.resolved / trainingProgress.total) * 100)
        : (totalDays > 0 ? Math.round((legacyResolvedDays / totalDays) * 100) : 0);
    const effectiveStatus = derivedStatus || instance.status;
    const canStartTodayTraining = effectiveStatus === 'active' && !isLogicallyCompleted;

    return (
        <div className="p-4 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Button icon="pi pi-arrow-left" text onClick={() => router.back()} />
                    <h1 className="text-xl font-bold m-0">{instance.name}</h1>
                </div>
                {canStartTodayTraining && (
                    <Button
                        label="开始今日训练"
                        icon="pi pi-play"
                        className="p-button-lg"
                        onClick={() => router.push('/today-training')}
                    />
                )}
            </div>

            {/* Summary Card */}
            <Card className="mb-4">
                <div className="flex flex-col gap-3">
                    <div className="flex gap-2 flex-wrap">
                        {getStatusTag(effectiveStatus)}
                        {getSourceTag(instance.source)}
                    </div>

                    {instance.description && (
                        <p className="text-gray-600 m-0">{instance.description}</p>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        <div>
                            <div className="text-sm text-gray-500">开始日期</div>
                            <div className="font-medium">{formatDate(instance.start_date)}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500">结束日期</div>
                            <div className="font-medium">{formatDate(instance.end_date)}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500">总天数</div>
                            <div className="font-medium">{totalDays} 天</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500">完成度</div>
                            <div className="font-medium text-primary-600">{completionRate}%</div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Training Days Section */}
            <div className="mb-4">
                {(() => {
                    // 🔒 计算已解锁的周次（仅对进行中的计划生效）
                    const unlockedWeek = canStartTodayTraining
                        ? Math.max(
                            calculateCurrentWeek(instance.start_date),
                            getDayWeekNumber(instance.start_execution_day || 1),
                        )
                        : Infinity; // 已完成/归档的计划显示全部
                    
                    return (
                        <>
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <i className="pi pi-calendar text-primary-600" />
                                训练安排
                                <span className="text-sm font-normal text-surface-500">共 {totalDays} 天计划</span>
                                {canStartTodayTraining && unlockedWeek < Infinity && (
                                    <span className="text-sm font-normal text-surface-400 ml-2">
                                        已解锁: 第 {unlockedWeek} 周
                                    </span>
                                )}
                            </h3>

                            <div className="space-y-4">
                                {instance.training_days?.map((day: any, index: number) => {
                                    // 使用 day 自带的 dayIndex（如果有），否则用 index + 1
                                    const dayIndex = day.dayIndex ?? (index + 1);
                                    const dayExecution = executions[dayIndex];
                                    
                                    // 📝 检查该天是否已解锁
                                    const isUnlocked = isDayUnlocked(dayIndex, unlockedWeek);
                                    const weekNumber = getDayWeekNumber(dayIndex);
                                    
                                    // 📝 制定中状态卡片
                                    if (!isUnlocked) {
                                        const isRestDay = day.type === 'rest';
                                        const actionSets = day.actionSets || [];
                                        
                                        return (
                                            <div key={index} className="border border-amber-100 rounded-xl p-4 bg-amber-50/30 relative overflow-hidden">
                                                <div className="absolute inset-0 bg-gradient-to-r from-amber-50/80 to-amber-50/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
                                                    <div className="text-center">
                                                        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                                            <i className="pi pi-pencil text-amber-500" />
                                                        </div>
                                                        <p className="text-sm font-medium text-amber-600">第 {weekNumber} 周 · 制定中</p>
                                                        <p className="text-xs text-amber-400">
                                                            {(() => {
                                                                const unlockDate = getUnlockDate(weekNumber, instance.start_date);
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
                                                            <h4 className="font-semibold text-surface-600">第{dayIndex}天</h4>
                                                            <p className="text-sm text-surface-400">
                                                                {isRestDay ? '休息日' : `${actionSets.length} 个动作`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    
                                    return (
                                        <TrainingDayCard
                                            key={index}
                                            day={{
                                                ...day,
                                                dayIndex,
                                            }}
                                            execution={dayExecution}
                                            actions={actions}
                                            getDayName={getDayName}
                                            getTrainingDate={getTrainingDate}
                                            defaultCollapsed={true}
                                        />
                                    );
                                })}
                            </div>
                        </>
                    );
                })()}
            </div>
        </div>
    );
}
