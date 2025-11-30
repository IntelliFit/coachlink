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
import paymentService from '@/app/service/paymentService';

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

    // 支付功能
    const handlePayment = async () => {
        try {
            // 创建支付订单并获取支付ID
            const response = await paymentService.createPayment({
                amount: 99.99,
                currency: 'CNY',
                orderId: `ORDER_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                description: '教练服务订阅'
            });
            
            if (response && response.paymentId) {
                // 跳转到支付页面，传递支付ID参数
                router.push(`/payment/${response.paymentId}`);
            } else {
                throw new Error('创建支付订单失败');
            }
        } catch (error) {
            console.error('创建支付订单失败:', error);
            // 错误处理可以在实际项目中添加提示框等
        }
    };

    if (loading) {
        return <LoadingSkeleton />;
    }

    if (!subscriptions.length)
        return (
            <div className="text-center py-12">
                <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">还没有订阅任何教练</h3>
                <p className="text-gray-600 mb-6 dark:text-gray-400">选择专业教练，开始您的健身之旅</p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Button 
                        label="浏览教练" 
                        className="p-button-primary px-6 py-3" 
                        onClick={() => router.push('/coach/discovery')} 
                    />
                    <Button 
                        label="立即支付 ¥99.99" 
                        className="p-button-success px-6 py-3" 
                        onClick={handlePayment}
                    />
                </div>
            </div>
        )

    return (
        <div className="space-y-8">
            <div className="flex justify-end">
                <Button 
                    label="支付订阅费用" 
                    icon="pi pi-credit-card" 
                    className="p-button-success"
                    onClick={handlePayment}
                />
            </div>
            <CoachList subscriptions={subscriptions}/>
            <TrainingSummary />
            <RecentActivity />
        </div>
    )
}

export default SubscriptionDashboard