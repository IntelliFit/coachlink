'use client';

import React, { useState, useEffect } from 'react';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Tag } from 'primereact/tag';
import { Skeleton } from 'primereact/skeleton';
import { useRouter, useParams } from 'next/navigation';
import { TrainingDayCard } from '@/components/plan/TrainingDayCard';
import { planLibService } from '@/app/service/planLibService';

interface PlanInstance {
    id: string;
    name: string;
    description: string | null;
    source: string | null;
    status: string;
    start_date: string | null;
    end_date: string | null;
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
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (instanceId) {
            fetchPlanDetail();
        }
    }, [instanceId]);

    const fetchPlanDetail = async () => {
        setLoading(true);
        try {
            // 获取计划实例详情（带动作信息）
            const res = await planLibService.getInstance({ id: instanceId });
            
            if (res?.instance) {
                setInstance(res.instance);
                
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
    const completedDays = Object.keys(executions).length;
    const completionRate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

    return (
        <div className="p-4 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Button icon="pi pi-arrow-left" text onClick={() => router.back()} />
                    <h1 className="text-xl font-bold m-0">{instance.name}</h1>
                </div>
                {instance.status === 'active' && (
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
                        {getStatusTag(instance.status)}
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
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <i className="pi pi-calendar text-primary-600" />
                    训练安排
                    <span className="text-sm font-normal text-surface-500">共 {totalDays} 天计划</span>
                </h3>

                <div className="space-y-4">
                    {instance.training_days?.map((day: any, index: number) => {
                        // 使用 day 自带的 dayIndex（如果有），否则用 index + 1
                        const dayIndex = day.dayIndex ?? (index + 1);
                        const dayExecution = executions[dayIndex];
                        
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
            </div>
        </div>
    );
}
