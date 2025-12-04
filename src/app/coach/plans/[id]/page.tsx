'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Skeleton } from 'primereact/skeleton';
import { subscriptionService } from '@/app/service/subscriptionService';
import { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';
import { useToastContext } from '@/context/ToastContext';

interface SubscriptionDetailProps {
    subscriptionId: string;
}

const SubscriptionDetailPage: React.FC<SubscriptionDetailProps> = ({ subscriptionId }) => {
    const { data: session } = useSession();
    const { showToast } = useToastContext();

    const [subscription, setSubscription] = useState<QueryCoachSubscription | null>(null);
    const [loading, setLoading] = useState(true);

    // 加载订阅详情
    useEffect(() => {
        if (!session?.user?.id || !subscriptionId) return;

        const load = async () => {
            try {
                setLoading(true);
                const res = await subscriptionService.getCoachSubscriptions({
                    studentId: session.user.id,
                });

                if (res) {
                    // 找到匹配的订阅
                    const matchedSubscription = res.subscriptions.find(sub => sub.id === subscriptionId);
                    if (matchedSubscription) {
                        setSubscription(matchedSubscription);
                    } else {
                        showToast({
                            severity: 'error',
                            summary: '加载失败',
                            detail: '未找到订阅信息',
                        });
                    }
                }
            } catch (e) {
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
    }, [session?.user?.id, subscriptionId]);

    // 骨架屏
    const SkeletonContent = () => (
        <div className="p-card shadow-sm">
            <div className="mb-6">
                <Skeleton width="200px" height="28px" className="mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton height="80px" />
                    <Skeleton height="80px" />
                    <Skeleton height="80px" />
                    <Skeleton height="80px" />
                </div>
            </div>
            <div className="border-t pt-6">
                <Skeleton width="200px" height="28px" className="mb-4" />
                <Skeleton height="60px" />
            </div>
        </div>
    );

    if (loading) {
        return <SkeletonContent />;
    }

    if (!subscription) {
        return (
            <div className="p-card shadow-sm text-center py-8">
                <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mx-auto mb-3">
                    <i className="pi pi-info-circle text-2xl text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    未找到订阅信息
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                    无法找到对应的订阅信息
                </p>
            </div>
        );
    }

    return (
        <div className="p-card shadow-sm">
            <div className="mb-6">
                <h2 className="text-xl font-semibold mb-4">订阅详情</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-surface-50 rounded-lg">
                        <p className="text-sm text-surface-500">订阅ID</p>
                        <p className="font-medium">{subscription.id}</p>
                    </div>
                    <div className="p-4 bg-surface-50 rounded-lg">
                        <p className="text-sm text-surface-500">教练</p>
                        <p className="font-medium">{subscription.coach?.name || '未知教练'}</p>
                    </div>
                    <div className="p-4 bg-surface-50 rounded-lg">
                        <p className="text-sm text-surface-500">开始日期</p>
                        <p className="font-medium">
                            {subscription.start_date 
                                ? new Date(subscription.start_date).toLocaleDateString() 
                                : '未设置'}
                        </p>
                    </div>
                    <div className="p-4 bg-surface-50 rounded-lg">
                        <p className="text-sm text-surface-500">状态</p>
                        <p className="font-medium capitalize">{subscription.status || '未知'}</p>
                    </div>
                </div>
            </div>
            
            <div className="border-t pt-6">
                <h2 className="text-xl font-semibold mb-4">内容区域</h2>
                <p className="text-surface-500">
                    这里将显示与该订阅相关的内容，具体内容将在后续开发中实现。
                </p>
            </div>
        </div>
    );
};

export default SubscriptionDetailPage;