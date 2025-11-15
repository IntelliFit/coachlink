'use client';

import React, { useEffect, useState } from 'react'
import { Target } from 'lucide-react'
import { Button } from 'primereact/button'
import { Skeleton } from 'primereact/skeleton';
import { subscriptionService } from '@/app/service/subscriptionService'
import { useSession } from 'next-auth/react'
import { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity'
import { useRouter } from 'next/navigation';
import CoachList from '@/app/coach/subscription/CoachList';
import TrainingSummary from '@/app/coach/subscription/TrainingSummary';
import RecentActivity from '@/app/coach/subscription/RecentActivity';

const SubscriptionDashboard = () => {

    const { data: session } = useSession();
    const router = useRouter();

    const [subscriptions, setSubscriptions] = useState<QueryCoachSubscription[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 仅当 session 存在时发起请求
        if (!session?.user?.id) return;

        const fetchSubscriptions = async () => {
            try {
                setLoading(true);
                const subscriptionsResponse = await subscriptionService.getCoachSubscriptions({
                    studentId: session.user.id,
                });
                setSubscriptions(subscriptionsResponse?.subscriptions || []);
            } catch (error) {
                console.error("加载订阅信息失败:", error);
                setSubscriptions([]);
            } finally {
                setLoading(false);
            }
        };

        fetchSubscriptions();
    }, [session?.user?.id]); // 依赖 session id

    const onAccessService = (serviceId: string, coachId: string) => {
        console.log('serviceId:', serviceId);
        console.log('coachId:', coachId);
    }

    // 骨架屏组件
    const LoadingSkeleton = () => (
        <div className="space-y-8">
            {/* 订阅列表骨架屏 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(item => (
                    <div key={item} className="shadow-sm rounded-lg overflow-hidden">
                        <Skeleton height="150px" className="mb-4" />
                        <div className="p-6">
                            <Skeleton width="60%" height="24px" className="mb-4" />
                            <Skeleton width="100%" height="40px" className="mb-2" />
                            <Skeleton width="100%" height="40px" className="mb-2" />
                            <Skeleton width="100%" height="40px" />
                        </div>
                    </div>
                ))}
            </div>

            {/* 训练统计骨架屏 */}
            <div className="p-6 shadow-sm rounded-lg">
                <Skeleton width="30%" height="24px" className="mb-6" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(item => (
                        <div key={item} className="text-center">
                            <Skeleton width="50px" height="50px" className="mx-auto mb-2" />
                            <Skeleton width="80%" height="24px" className="mx-auto mb-1" />
                            <Skeleton width="60%" height="20px" className="mx-auto" />
                        </div>
                    ))}
                </div>
            </div>

            {/* 最近活动骨架屏 */}
            <div className="p-6 shadow-sm rounded-lg">
                <Skeleton width="30%" height="24px" className="mb-6" />
                {[1, 2, 3].map(item => (
                    <div key={item} className="flex items-center space-x-4 p-4 mb-4" style={{ height: '80px' }}>
                        <Skeleton width="40px" height="40px" className="rounded-full" />
                        <div className="flex-1">
                            <Skeleton width="80%" height="20px" className="mb-2" />
                            <Skeleton width="60%" height="16px" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    if (loading) {
        return <LoadingSkeleton />;
    }

    if (!subscriptions.length)
        return (
            <div className="text-center py-12">
                <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">还没有订阅任何教练</h3>
                <p className="text-gray-600 mb-6 dark:text-gray-400">选择专业教练，开始您的健身之旅</p>
                <Button label="浏览教练" className="p-button-primary px-6 py-3" onClick={() => router.push('/coach/discovery')} />
            </div>
        )

    return (
        <div className="space-y-8">
            <CoachList subscriptions={subscriptions} onAccessService={onAccessService} />
            <TrainingSummary />
            <RecentActivity />
        </div>
    )
}

export default SubscriptionDashboard