'use client';

import React, { useState, useEffect } from 'react';
import { Card } from 'primereact/card';
import { Tag } from 'primereact/tag';
import { Skeleton } from 'primereact/skeleton';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Dialog } from 'primereact/dialog';
import { planLibService } from '@/app/service/planLibService';
import { TrainingDayCard } from '@/components/plan/TrainingDayCard';

interface PlanHistoryItem {
    id: string;
    name: string;
    description: string | null;
    source: string | null;
    status: string;
    start_date: string | null;
    end_date: string | null;
    total_days?: number;
}

interface StudentPlanHistoryProps {
    studentId: string;
    limit?: number;
}

export const StudentPlanHistory: React.FC<StudentPlanHistoryProps> = ({
    studentId,
    limit = 5
}) => {
    const [plans, setPlans] = useState<PlanHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [sourceFilter, setSourceFilter] = useState<'all' | 'coach' | 'student'>('all');
    
    // 详情弹窗
    const [detailDialogVisible, setDetailDialogVisible] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<any>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [planActions, setPlanActions] = useState<Record<string, any>>({});
    const [planExecutions, setPlanExecutions] = useState<Record<number, any>>({});

    const sourceOptions = [
        { label: '全部', value: 'all' },
        { label: '我指派的', value: 'coach' },
        { label: '学员自建', value: 'student' },
    ];

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/coach/student-plan-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId, page, limit, source: sourceFilter }),
            });
            const data = await res.json();
            if (data.success) {
                setPlans(data.data.plans);
                setTotalCount(data.data.totalCount);
            }
        } catch (error) {
            // console.error('获取学员计划历史失败:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (studentId) {
            fetchHistory();
        }
    }, [studentId, page, sourceFilter]);

    // 查看计划详情
    const handleViewPlanDetail = async (planId: string) => {
        setDetailDialogVisible(true);
        setDetailLoading(true);
        setSelectedPlan(null);
        setPlanActions({});
        setPlanExecutions({});
        
        try {
            // 获取计划实例详情
            const res = await planLibService.getInstance({ id: planId });
            if (res?.instance) {
                setSelectedPlan(res.instance);
                if (res.actions) {
                    setPlanActions(res.actions);
                }
            }
            
            // 获取执行记录
            const exeRes = await planLibService.getWithExecutions({ instanceId: planId });
            if (exeRes?.executions) {
                setPlanExecutions(exeRes.executions);
            }
        } catch (error) {
            console.error('获取计划详情失败:', error);
        } finally {
            setDetailLoading(false);
        }
    };

    const getStatusTag = (status: string) => {
        switch (status) {
            case 'active':
                return <Tag severity="success" value="进行中" className="text-xs" />;
            case 'completed':
                return <Tag severity="info" value="已完成" className="text-xs" />;
            case 'archived':
                return <Tag severity="warning" value="已归档" className="text-xs" />;
            case 'scheduled':
                return <Tag severity="secondary" value="待执行" className="text-xs" />;
            default:
                return <Tag value={status} className="text-xs" />;
        }
    };

    const getSourceBadge = (source: string | null) => {
        if (source === 'coach') {
            return <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">教练指派</span>;
        }
        if (source === 'ai') {
            return <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">智能生成</span>;
        }
        return <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">学员自建</span>;
    };

    const formatDateRange = (start: string | null, end: string | null) => {
        if (!start) return '-';
        const startDate = new Date(start).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
        const endDate = end ? new Date(end).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) : '至今';
        return `${startDate} - ${endDate}`;
    };

    const getDayName = (dayIndex: number) => `第${dayIndex}天`;
    
    const getTrainingDate = (dayIndex: number) => {
        if (!selectedPlan?.start_date) return '';
        const startDate = new Date(selectedPlan.start_date);
        const date = new Date(startDate.getTime() + (dayIndex - 1) * 24 * 60 * 60 * 1000);
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    };

    if (loading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="p-4 rounded-xl bg-surface-50 border border-surface-100">
                        <Skeleton height="1rem" width="60%" className="mb-2" />
                        <Skeleton height="0.75rem" width="40%" />
                    </div>
                ))}
            </div>
        );
    }

    if (plans.length === 0) {
        return (
            <div className="text-center py-8 text-surface-400">
                <i className="pi pi-folder-open text-3xl mb-3 block" />
                <p className="text-sm">暂无计划记录</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filter */}
            <div className="flex justify-between items-center">
                <span className="text-xs text-surface-500">共 {totalCount} 个计划</span>
                <Dropdown
                    value={sourceFilter}
                    options={sourceOptions}
                    onChange={(e) => {
                        setSourceFilter(e.value);
                        setPage(1);
                    }}
                    className="p-inputtext-sm text-xs"
                    style={{ minWidth: '100px' }}
                />
            </div>

            {/* List */}
            <div className="space-y-2">
                {plans.map((plan) => (
                    <div
                        key={plan.id}
                        className="p-4 rounded-xl bg-surface-50/50 border border-surface-100 hover:border-primary-200 hover:bg-surface transition-all cursor-pointer"
                        onClick={() => handleViewPlanDetail(plan.id)}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-surface-800 text-sm">{plan.name}</h4>
                            {getStatusTag(plan.status)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-surface-500">
                            {getSourceBadge(plan.source)}
                            <span className="flex items-center gap-1">
                                <i className="pi pi-calendar text-xs" />
                                {formatDateRange(plan.start_date, plan.end_date)}
                            </span>
                            {plan.total_days && (
                                <span>{plan.total_days}天</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination */}
            {totalCount > limit && (
                <div className="flex justify-center gap-2 pt-2">
                    <Button
                        icon="pi pi-chevron-left"
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        text
                        size="small"
                    />
                    <span className="text-xs text-surface-500 flex items-center">
                        {page} / {Math.ceil(totalCount / limit)}
                    </span>
                    <Button
                        icon="pi pi-chevron-right"
                        disabled={page >= Math.ceil(totalCount / limit)}
                        onClick={() => setPage(p => p + 1)}
                        text
                        size="small"
                    />
                </div>
            )}

            {/* Plan Detail Dialog */}
            <Dialog
                visible={detailDialogVisible}
                onHide={() => setDetailDialogVisible(false)}
                header={selectedPlan?.name || '计划详情'}
                style={{ width: '800px', maxWidth: '95vw' }}
                modal
                maximizable
            >
                {detailLoading ? (
                    <div className="space-y-4">
                        <Skeleton height="2rem" width="50%" className="mb-4" />
                        <Skeleton height="8rem" className="mb-2" />
                        <Skeleton height="8rem" className="mb-2" />
                    </div>
                ) : selectedPlan ? (
                    <div className="space-y-6">
                        {/* Plan Info */}
                        <div className="flex flex-wrap gap-4 text-sm text-surface-600">
                            {getStatusTag(selectedPlan.status)}
                            {getSourceBadge(selectedPlan.source)}
                            <span>
                                <i className="pi pi-calendar mr-1" />
                                {formatDateRange(selectedPlan.start_date, selectedPlan.end_date)}
                            </span>
                        </div>
                        
                        {selectedPlan.description && (
                            <p className="text-sm text-surface-600">{selectedPlan.description}</p>
                        )}

                        {/* Training Days */}
                        <div>
                            <h4 className="font-semibold text-surface-800 mb-4">
                                训练安排 ({selectedPlan.training_days?.length || 0} 天)
                            </h4>
                            <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                                {selectedPlan.training_days?.map((day: any, index: number) => {
                                    const dayIndex = day.dayIndex ?? (index + 1);
                                    return (
                                        <TrainingDayCard
                                            key={index}
                                            day={{ ...day, dayIndex }}
                                            execution={planExecutions[dayIndex]}
                                            actions={planActions}
                                            getDayName={getDayName}
                                            getTrainingDate={getTrainingDate}
                                            defaultCollapsed={true}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-surface-400">
                        加载失败，请重试
                    </div>
                )}
            </Dialog>
        </div>
    );
};

export default StudentPlanHistory;

