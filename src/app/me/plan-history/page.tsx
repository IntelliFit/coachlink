'use client';

import React, { useState, useEffect } from 'react';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Tag } from 'primereact/tag';
import { ProgressBar } from 'primereact/progressbar';
import { Skeleton } from 'primereact/skeleton';
import { Dropdown } from 'primereact/dropdown';
import { useRouter } from 'next/navigation';
import type { PlanHistoryItem } from '@/app/api/student/plan-lib/list-history/entity';

interface HistoryResponse {
    success: boolean;
    data: {
        plans: PlanHistoryItem[];
        totalCount: number;
        page: number;
        limit: number;
    };
}

export default function PlanHistoryPage() {
    const router = useRouter();
    const [plans, setPlans] = useState<PlanHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [sourceFilter, setSourceFilter] = useState<'all' | 'coach' | 'student'>('all');
    const limit = 10;

    const sourceOptions = [
        { label: '全部计划', value: 'all' },
        { label: '教练指派', value: 'coach' },
        { label: '我的计划', value: 'student' },
    ];

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/student/plan-lib/list-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ page, limit, source: sourceFilter }),
            });
            const data: HistoryResponse = await res.json();
            if (data.success) {
                setPlans(data.data.plans);
                setTotalCount(data.data.totalCount);
            }
        } catch (error) {
            console.error('获取历史计划失败:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [page, sourceFilter]);

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

    const formatDateRange = (start: string | null, end: string | null) => {
        if (!start) return '-';
        const startDate = new Date(start).toLocaleDateString('zh-CN');
        const endDate = end ? new Date(end).toLocaleDateString('zh-CN') : '至今';
        return `${startDate} - ${endDate}`;
    };

    const PlanCard = ({ plan }: { plan: PlanHistoryItem }) => (
        <Card className="mb-3 cursor-pointer hover:shadow-lg transition-shadow duration-200"
            onClick={() => router.push(`/me/plan-history/${plan.id}`)}
        >
            <div className="flex flex-col gap-3">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-2">
                        <h3 className="text-lg font-semibold m-0">{plan.name}</h3>
                        <div className="flex gap-2">
                            {getStatusTag(plan.status)}
                            {getSourceTag(plan.source)}
                        </div>
                    </div>
                    <i className="pi pi-chevron-right text-gray-400" />
                </div>

                {/* Details */}
                <div className="text-sm text-gray-600">
                    <div className="flex items-center gap-2 mb-1">
                        <i className="pi pi-calendar" />
                        <span>{formatDateRange(plan.start_date, plan.end_date)}</span>
                    </div>
                    {plan.total_days && (
                        <div className="flex items-center gap-2">
                            <i className="pi pi-list" />
                            <span>共 {plan.total_days} 天</span>
                        </div>
                    )}
                </div>

                {/* Progress */}
                {plan.completion_rate !== undefined && (
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span>完成度</span>
                            <span>{plan.completion_rate}%</span>
                        </div>
                        <ProgressBar value={plan.completion_rate} showValue={false} style={{ height: '6px' }} />
                    </div>
                )}

                {/* Description */}
                {plan.description && (
                    <p className="text-sm text-gray-500 m-0 line-clamp-2">{plan.description}</p>
                )}
            </div>
        </Card>
    );

    const LoadingSkeleton = () => (
        <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
                <Card key={i} className="mb-3">
                    <Skeleton height="1.5rem" width="60%" className="mb-2" />
                    <Skeleton height="1rem" width="40%" className="mb-3" />
                    <Skeleton height="0.5rem" width="100%" />
                </Card>
            ))}
        </div>
    );

    const EmptyState = () => (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <i className="pi pi-history text-4xl text-gray-300 mb-4" />
            <h3 className="text-xl font-medium text-gray-600 mb-2">暂无计划</h3>
            <p className="text-gray-400 mb-4">当前和历史计划将显示在这里</p>
            <Button
                label="开始训练"
                icon="pi pi-play"
                onClick={() => router.push('/today-training')}
            />
        </div>
    );

    return (
        <div className="p-4 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <Button
                        icon="pi pi-arrow-left"
                        text
                        onClick={() => router.back()}
                    />
                    <h1 className="text-xl font-bold m-0">我的计划</h1>
                </div>
            </div>

            {/* Filter */}
            <div className="mb-4">
                <Dropdown
                    value={sourceFilter}
                    options={sourceOptions}
                    onChange={(e) => {
                        setSourceFilter(e.value);
                        setPage(1);
                    }}
                    className="w-full md:w-auto"
                />
            </div>

            {/* Content */}
            {loading ? (
                <LoadingSkeleton />
            ) : plans.length === 0 ? (
                <EmptyState />
            ) : (
                <>
                    <div className="text-sm text-gray-500 mb-3">
                        共 {totalCount} 个计划
                    </div>
                    {plans.map((plan) => (
                        <PlanCard key={plan.id} plan={plan} />
                    ))}

                    {/* Pagination */}
                    {totalCount > limit && (
                        <div className="flex justify-center gap-2 mt-4">
                            <Button
                                label="上一页"
                                icon="pi pi-chevron-left"
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                                text
                            />
                            <span className="flex items-center px-3">
                                {page} / {Math.ceil(totalCount / limit)}
                            </span>
                            <Button
                                label="下一页"
                                icon="pi pi-chevron-right"
                                iconPos="right"
                                disabled={page >= Math.ceil(totalCount / limit)}
                                onClick={() => setPage(p => p + 1)}
                                text
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
