'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { Card } from 'primereact/card';
import { Badge } from 'primereact/badge';
import { subscriptionService } from '@/app/service/subscriptionService';
import { planLibService } from '@/app/service/planLibService';
import { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';
import { useToastContext } from '@/context/ToastContext';
import { CoachPlanInstanceRow } from '@/types';

const TrainingPlansHome: React.FC = () => {
    const { data: session } = useSession();
    const { showToast } = useToastContext();

    const [subscriptions, setSubscriptions] = useState<QueryCoachSubscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSubscriptionId, setActiveSubscriptionId] = useState<string | null>(null);
    const [instances, setInstances] = useState<Record<string, CoachPlanInstanceRow | null>>({});
    const [instanceLoading, setInstanceLoading] = useState<Record<string, boolean>>({});

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

    // 加载计划实例
    useEffect(() => {
        if (!subscriptions.length || !activeSubscriptionId) return;

        const loadInstance = async () => {
            setInstanceLoading(prev => ({ ...prev, [activeSubscriptionId]: true }));

            try {
                const instance = await planLibService.getInstance({ 
                    id: activeSubscriptionId
                });
                
                setInstances(prev => ({ ...prev, [activeSubscriptionId]: instance }));
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

    // 计划详情卡片
    const PlanDetailCard = ({ instance }: { instance: CoachPlanInstanceRow }) => {
        const statusConfig = getStatusConfig(instance.status);
        
        return (
            <div className="space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-2xl font-bold text-surface-900">
                                {instance.name || '训练计划'}
                            </h2>
                            <Badge 
                                value={statusConfig.label}
                                severity={statusConfig.color}
                                className="rounded-full px-3 py-1"
                            />
                        </div>
                        <p className="text-surface-600 text-lg leading-relaxed">
                            {instance.description || '暂无描述'}
                        </p>
                    </div>
                    <Button 
                        label="查看详情" 
                        icon="pi pi-external-link"
                        className="rounded-full"
                        outlined
                        onClick={() => {/* 导航到计划详情页 */}}
                    />
                </div>

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
                                    {instance.training_days?.days?.length || 0} 天
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card className="bg-surface-50 border-0">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center">
                                <i className="pi pi-id-card text-xl text-info" />
                            </div>
                            <div>
                                <p className="text-sm text-surface-500 mb-1">计划ID</p>
                                <p className="font-mono text-sm truncate" title={instance.id}>
                                    {instance.id.substring(0, 8)}...
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
                                        className={`group relative px-5 py-3 rounded-xl transition-all duration-300 flex items-center gap-3 ${
                                            isActive
                                                ? 'bg-gradient-to-r from-primary to-primary-600 text-surface shadow-lg shadow-primary/20'
                                                : 'bg-surface text-surface-700 border border-surface-200 hover:shadow-md'
                                        }`}
                                        onClick={() => setActiveSubscriptionId(subscription.id)}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                            isActive 
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
        </div>
    );
};

export default TrainingPlansHome;