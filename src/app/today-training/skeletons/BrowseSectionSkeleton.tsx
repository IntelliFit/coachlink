'use client';

import React from 'react';
import { Skeleton } from 'primereact/skeleton';
import { Card } from 'primereact/card';

const BrowseSectionSkeleton: React.FC = () => {
    return (
        <div className="mt-8">
            <Card>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4">
                    <Skeleton width="120px" height="24px" className="bg-surface-200/50 rounded" />
                    <div className="flex items-center gap-2">
                        <Skeleton shape="circle" size="2rem" className="bg-surface-100/50" />
                        <Skeleton width="60px" height="20px" className="bg-surface-100/50 rounded" />
                        <Skeleton shape="circle" size="2rem" className="bg-surface-100/50" />
                    </div>
                </div>

                {/* Week Calendar Skeleton */}
                <div className="bg-surface rounded-2xl p-3 sm:p-4 mb-6">
                    <div className="grid grid-cols-7 gap-2">
                        {Array.from({ length: 7 }).map((_, i) => (
                            <div
                                key={i}
                                className="flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl bg-gray-50"
                            >
                                <Skeleton width="40px" height="12px" className="bg-surface-100/50 rounded mb-1" />
                                <Skeleton width="24px" height="24px" className="bg-surface-200/50 rounded mb-1" />
                                <Skeleton width="50px" height="12px" className="bg-surface-100/50 rounded" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Selected Day Preview Skeleton */}
                <div className="space-y-4">
                    <div>
                        <Skeleton width="100px" height="20px" className="bg-surface-200/50 rounded mb-2" />
                        <Skeleton width="120px" height="16px" className="bg-surface-100/50 rounded" />
                    </div>

                    <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-gray-50 rounded p-3">
                                <Skeleton width="200px" height="18px" className="bg-surface-200/50 rounded mb-2" />
                                <Skeleton width="250px" height="16px" className="bg-surface-100/50 rounded" />
                            </div>
                        ))}
                    </div>

                    <Skeleton width="100%" height="2.5rem" className="bg-surface-100/50 rounded-xl" />
                </div>
            </Card>
        </div>
    );
};

export default BrowseSectionSkeleton;
