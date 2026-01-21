'use client';

import React from 'react';
import { Skeleton } from 'primereact/skeleton';
import { Avatar } from 'primereact/avatar';

const CoachCardSkeleton: React.FC = () => {
    return (
        <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-6 mb-8 text-surface shadow-2xl shadow-surface-100 dark:shadow-slate-700">
            {/* 背景装饰图形 */}
            <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-primary-500/20 rounded-full blur-3xl"></div>
            <div className="absolute bottom-[-20%] left-[-5%] w-48 h-48 bg-blue-500/10 rounded-full blur-2xl"></div>

            <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center space-x-5">
                    <div className="relative">
                        <Skeleton shape="circle" size="4rem" className="bg-surface-100/30" />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-surface-200 rounded-full border-4 border-slate-900"></div>
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Skeleton width="80px" height="20px" className="bg-surface-100/30 rounded" />
                            <Skeleton width="120px" height="14px" className="bg-surface-100/30 rounded" />
                        </div>
                        <Skeleton width="150px" height="28px" className="bg-surface-100/30 rounded mb-2" />
                        <Skeleton width="120px" height="16px" className="bg-surface-100/30 rounded" />
                    </div>
                </div>

                <div className="hidden md:block text-right border-l border-surface/10 pl-8">
                    <Skeleton width="80px" height="14px" className="bg-surface-100/30 rounded mb-1" />
                    <Skeleton width="100px" height="24px" className="bg-surface-100/30 rounded" />
                </div>
            </div>
        </div>
    );
};

export default CoachCardSkeleton;
