'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Skeleton } from 'primereact/skeleton';
import { friendService } from '@/app/service/friendService';
import { ActivityCard } from '@/components/social/ActivityCard';
import { Users, Activity, ArrowLeft } from 'lucide-react';

const AERO_CONTAINER = "max-w-2xl mx-auto px-4";
const AERO_CARD = "rounded-3xl border border-surface-100 bg-surface-0 shadow-[0_1px_0_rgba(15,23,42,0.02)] hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition-[box-shadow,transform]";
const AERO_TITLE = "text-xl font-bold tracking-tight text-surface-900";
const AERO_SUBTITLE = "text-sm text-surface-600 mt-1";

export default function FriendActivityPage() {
    const router = useRouter();
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadActivities();
    }, []);

    const loadActivities = async () => {
        try {
            const res = await friendService.getActivity();
            if (res.success) {
                setActivities(res.data?.activities || []);
            }
        } finally {
            setLoading(false);
        }
    };

    // 骨架屏组件
    const ActivitySkeleton = () => (
        <Card className={AERO_CARD}>
            <div className="p-4">
                <div className="flex items-center gap-3 mb-4">
                    <Skeleton shape="circle" size="2.5rem" />
                    <div className="flex-1 space-y-2">
                        <Skeleton width="40%" height="0.875rem" />
                        <Skeleton width="25%" height="0.75rem" />
                    </div>
                </div>
                <div className="rounded-2xl bg-surface-50 p-4">
                    <Skeleton width="60%" height="1rem" className="mb-3" />
                    <div className="flex gap-4">
                        <Skeleton width="4rem" height="0.75rem" />
                        <Skeleton width="5rem" height="0.75rem" />
                    </div>
                </div>
            </div>
        </Card>
    );

    return (
        <div className="min-h-screen pb-24">
            {/* 背景装饰 */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary-100/30 to-transparent" />

            <div className="relative z-10">
                {/* Header */}
                <div className={`${AERO_CONTAINER} pt-6 pb-4`}>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <Button 
                                icon={<ArrowLeft className="w-5 h-5" />} 
                                text 
                                rounded
                                className="!w-10 !h-10 text-surface-700 hover:bg-surface-100 active:scale-[0.98] transition-all"
                                onClick={() => router.back()} 
                            />
                            <div>
                                <h1 className={AERO_TITLE}>好友动态</h1>
                                <p className={AERO_SUBTITLE}>看看伙伴们都在练什么</p>
                            </div>
                        </div>
                        <Button 
                            icon={<Users className="mr-2 w-4 h-4" />} 
                            label="我的好友"
                            size="small"
                            className="!rounded-2xl !h-9 !px-4 bg-surface-900 border-none text-surface-0 text-xs font-bold hover:bg-surface-800 active:scale-[0.98] transition-all"
                            onClick={() => router.push('/friends')} 
                        />
                    </div>
                </div>

                <div className={`${AERO_CONTAINER} space-y-3`}>
                    {loading ? (
                        <>
                            <ActivitySkeleton />
                            <ActivitySkeleton />
                            <ActivitySkeleton />
                        </>
                    ) : activities.length === 0 ? (
                        <Card className={AERO_CARD}>
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 rounded-3xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
                                    <Activity className="w-8 h-8 text-surface-400" />
                                </div>
                                <div className="text-surface-900 font-bold mb-1">暂无好友动态</div>
                                <div className="text-sm text-surface-500 mb-5">快去添加好友，看看大家都在练什么</div>
                                <Button 
                                    icon={<Users className="w-4 h-4" />}
                                    label="去添加好友" 
                                    className="!rounded-2xl !h-10 !px-6 bg-surface-900 border-none text-surface-0 text-sm font-bold hover:bg-surface-800 active:scale-[0.98] transition-all"
                                    onClick={() => router.push('/friends')}
                                />
                            </div>
                        </Card>
                    ) : (
                        <>
                            {activities.map(activity => (
                                <ActivityCard key={activity.id} activity={activity} />
                            ))}
                            
                            <div className="text-center py-6">
                                <div className="inline-flex items-center gap-2 text-xs text-surface-400 font-medium">
                                    <div className="w-8 h-px bg-surface-200" />
                                    <span>已经到底了</span>
                                    <div className="w-8 h-px bg-surface-200" />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
