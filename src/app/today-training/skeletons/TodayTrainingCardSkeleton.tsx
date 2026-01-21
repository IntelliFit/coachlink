'use client';

import React from 'react';
import { Skeleton } from 'primereact/skeleton';
import { Card } from 'primereact/card';

const TodayTrainingCardSkeleton: React.FC = () => {
    return (
        <Card className="shadow-lg border-2 border-primary-500 rounded-3xl">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                        <Skeleton width="200px" height="20px" className="bg-surface-100/50 rounded mb-2" />
                        <Skeleton width="120px" height="32px" className="bg-surface-200/50 rounded" />
                    </div>
                    <div className="sm:text-right">
                        <Skeleton width="80px" height="16px" className="bg-surface-100/50 rounded mb-2" />
                        <Skeleton width="100px" height="24px" className="bg-surface-200/50 rounded" />
                    </div>
                </div>

                {/* Action List Skeleton */}
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="bg-surface-50 rounded-2xl p-4 border border-surface-200"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Skeleton shape="circle" size="1.5rem" className="bg-primary-100/50" />
                                        <Skeleton width="150px" height="20px" className="bg-surface-200/50 rounded" />
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        <Skeleton width="80px" height="16px" className="bg-surface-100/50 rounded-full" />
                                        <Skeleton width="100px" height="16px" className="bg-surface-100/50 rounded-full" />
                                        <Skeleton width="90px" height="16px" className="bg-surface-100/50 rounded-full" />
                                    </div>
                                </div>
                                <div className="flex gap-2 ml-4">
                                    <Skeleton shape="circle" size="2rem" className="bg-surface-100/50" />
                                    <Skeleton shape="circle" size="2rem" className="bg-surface-100/50" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Button Skeleton */}
                <Skeleton width="100%" height="3rem" className="bg-primary-100/50 rounded-2xl" />
            </div>
        </Card>
    );
};

export default TodayTrainingCardSkeleton;
