'use client';

import React from 'react';
import { Skeleton } from 'primereact/skeleton';

const SelfPlanCardSkeleton: React.FC = () => {
    return (
        <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-6 mb-8 text-surface shadow-2xl shadow-surface-100 dark:shadow-slate-800">
            {/* 背景装饰图形 */}
            <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-primary-500/20 rounded-full blur-3xl"></div>
            <div className="absolute bottom-[-20%] left-[-5%] w-48 h-48 bg-pink-500/10 rounded-full blur-2xl"></div>

            <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center space-x-5">
                    <div className="relative">
                        <Skeleton width="4rem" height="4rem" className="bg-surface-100/30 rounded-2xl" />
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Skeleton width="90px" height="20px" className="bg-surface-100/30 rounded" />
                            <Skeleton width="140px" height="14px" className="bg-surface-100/30 rounded" />
                        </div>
                        <Skeleton width="180px" height="28px" className="bg-surface-100/30 rounded mb-2" />
                        <Skeleton width="120px" height="16px" className="bg-surface-100/30 rounded" />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Skeleton shape="circle" size="2.5rem" className="bg-surface-100/30" />
                </div>
            </div>
        </div>
    );
};

export default SelfPlanCardSkeleton;
