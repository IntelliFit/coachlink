'use client';

import React, { useEffect, useState } from 'react'
import { Target } from 'lucide-react'
import { Button } from 'primereact/button'
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

    useEffect(() => {
        // 仅当 session 存在时发起请求
        if (!session?.user?.id) return;

        const fetchSubscriptions = async () => {
            try {
                const subscriptionsResponse = await subscriptionService.getCoachSubscriptions({
                    studentId: session.user.id,
                });
                setSubscriptions(subscriptionsResponse?.subscriptions || []);
            } catch (error) {
                console.error("加载订阅信息失败:", error);
            }
        };

        fetchSubscriptions();
    }, [session?.user?.id]); // 依赖 session id

    const onAccessService = (serviceId: string, coachId: string) => {
        console.log('serviceId:', serviceId);
        console.log('coachId:', coachId);
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