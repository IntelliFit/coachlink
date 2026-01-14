'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CoachDashboardProps } from '@/types/coach';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { Skeleton } from 'primereact/skeleton';

const CoachDashboard: React.FC<CoachDashboardProps> = () => {
    const { data: session, status } = useSession();
    const router = useRouter();
    
    const coach = getCoach(session);

    useEffect(() => {
        if (status !== 'loading' && session) {
            router.push('/dashboard/overview');
        }
    }, [status, session, router]);

    // 骨架图加载状态
    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-surface-50 p-6 md:p-10">
                <div className="max-w-[1200px] mx-auto space-y-8">
                    {/* 顶部导航骨架 */}
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <Skeleton shape="circle" size="3rem" />
                            <div>
                                <Skeleton width="8rem" className="mb-2" />
                                <Skeleton width="5rem" />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Skeleton width="4rem" height="2.5rem" borderRadius="12px" />
                            <Skeleton width="4rem" height="2.5rem" borderRadius="12px" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* 左侧侧边栏骨架 */}
                        <div className="md:col-span-1 space-y-4">
                            <Skeleton height="20rem" borderRadius="24px" />
                        </div>

                        {/* 右侧主内容骨架 */}
                        <div className="md:col-span-2 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <Skeleton height="8rem" borderRadius="20px" />
                                <Skeleton height="8rem" borderRadius="20px" />
                            </div>
                            <Skeleton height="15rem" borderRadius="24px" />
                            <Skeleton height="10rem" borderRadius="24px" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!session) {
        // 注意：在 useEffect 或渲染逻辑中直接 push 可能会引起警告，
        // 但保持您原有逻辑不动，仅修改样式。
        router.push('/login');
        return null;
    }

    return (
        <div className="min-h-screen">
            {/* 内容重定向中... */}
        </div>
    );
};

export default CoachDashboard;