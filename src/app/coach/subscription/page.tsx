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
            {/* 订阅列表骨架屏 - 更新为2列网格 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[1, 2].map(item => (
                    <div key={item} className="rounded-lg overflow-hidden border border-surface-200">
                        {/* 顶部状态栏 */}
                        <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-3">
                            <Skeleton width="120px" height="20px" className="bg-white/20" />
                        </div>
                        
                        {/* 教练信息 */}
                        <div className="p-6">
                            {/* 头像和基本信息 */}
                            <div className="flex gap-6 mb-6">
                                <Skeleton shape="circle" size="6rem" />
                                <div className="flex-1">
                                    <Skeleton width="60%" height="24px" className="mb-2" />
                                    <Skeleton width="40%" height="16px" className="mb-3" />
                                    <div className="flex gap-4">
                                        <Skeleton width="60px" height="16px" />
                                        <Skeleton width="60px" height="16px" />
                                        <Skeleton width="60px" height="16px" />
                                    </div>
                                </div>
                            </div>
                            
                            {/* 专业领域 */}
                            <div className="mb-4">
                                <Skeleton width="80px" height="16px" className="mb-2" />
                                <div className="flex gap-2">
                                    <Skeleton width="70px" height="24px" borderRadius="1rem" />
                                    <Skeleton width="80px" height="24px" borderRadius="1rem" />
                                    <Skeleton width="60px" height="24px" borderRadius="1rem" />
                                </div>
                            </div>
                            
                            {/* 教学经验和案例 */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <Skeleton width="60%" height="16px" className="mb-1" />
                                    <Skeleton width="80%" height="16px" />
                                </div>
                                <div>
                                    <Skeleton width="60%" height="16px" className="mb-1" />
                                    <Skeleton width="80%" height="16px" />
                                </div>
                            </div>
                            
                            {/* 简介 */}
                            <div className="mb-4">
                                <Skeleton width="60px" height="16px" className="mb-1" />
                                <Skeleton width="100%" height="14px" className="mb-1" />
                                <Skeleton width="90%" height="14px" />
                            </div>
                            
                            {/* 按钮 */}
                            <div className="flex gap-2 pt-4 border-t border-surface-200">
                                <Skeleton width="50%" height="36px" />
                                <Skeleton width="50%" height="36px" />
                            </div>
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
                <Target className="w-16 h-16 text-surface-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">还没有订阅任何教练</h3>
                <p className="text-surface-600 mb-6">选择专业教练，开始您的健身之旅</p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Button 
                        label="浏览教练" 
                        className="p-button-primary px-6 py-3" 
                        onClick={() => router.push('/coach/discovery')} 
                    />
                </div>
            </div>
        )

    return (
        <div>
            <CoachList subscriptions={subscriptions}/>
        </div>
    )
}

export default SubscriptionDashboard