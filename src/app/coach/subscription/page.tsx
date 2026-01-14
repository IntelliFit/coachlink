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
    const LoadingSkeleton = () => {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
                {[1, 2, 3, 4].map((item) => (
                    <div
                        key={item}
                        className="bg-surface rounded-[24px] border border-surface-100 overflow-hidden"
                    >
                        <div className="p-6">
                            {/* 头部区域骨架 */}
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex gap-4">
                                    {/* 头像预留 - 20px 圆角 */}
                                    <Skeleton
                                        width="4rem"
                                        height="4rem"
                                        className="rounded-[20px] bg-surface-50"
                                    />

                                    <div className="flex flex-col gap-2 mt-1">
                                        {/* 名字 */}
                                        <Skeleton width="120px" height="20px" className="bg-surface-100" />
                                        {/* 称号 */}
                                        <Skeleton width="80px" height="12px" className="bg-surface-50" />
                                    </div>
                                </div>
                                {/* 状态标签预留 */}
                                <Skeleton width="60px" height="22px" borderRadius="11px" className="bg-surface-50" />
                            </div>

                            {/* 数值指标卡骨架：模拟 3 列布局 */}
                            <div className="grid grid-cols-3 gap-px bg-surface-100 border border-surface-100 rounded-2xl overflow-hidden mb-6">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="bg-surface p-3 flex flex-col items-center gap-2">
                                        <Skeleton width="30px" height="10px" className="bg-surface-50" />
                                        <Skeleton width="45px" height="18px" className="bg-surface-100" />
                                    </div>
                                ))}
                            </div>

                            {/* 专业领域 Tag 骨架 */}
                            <div className="flex flex-wrap gap-1.5 mb-5">
                                <Skeleton width="50px" height="24px" borderRadius="8px" className="bg-surface-50" />
                                <Skeleton width="65px" height="24px" borderRadius="8px" className="bg-surface-50" />
                                <Skeleton width="55px" height="24px" borderRadius="8px" className="bg-surface-50" />
                            </div>

                            {/* 教练简介：两行约束 */}
                            <div className="mb-6 space-y-2">
                                <Skeleton width="100%" height="14px" className="bg-surface-50" />
                                <Skeleton width="60%" height="14px" className="bg-surface-50" />
                            </div>

                            {/* 操作区域：左小右大 */}
                            <div className="flex gap-3">
                                {/* 在线咨询图标按钮 */}
                                <Skeleton
                                    width="3rem"
                                    height="3rem"
                                    borderRadius="1rem"
                                    className="bg-surface-50"
                                />
                                {/* 查看详情主按钮 */}
                                <Skeleton
                                    height="3rem"
                                    borderRadius="1rem"
                                    className="flex-1 bg-surface-100"
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

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
            <CoachList subscriptions={subscriptions} />
        </div>
    )
}

export default SubscriptionDashboard