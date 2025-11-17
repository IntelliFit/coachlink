'use client';

import React from 'react';

const CoachContentSkeleton: React.FC = () => {
    return (
        <div className="space-y-6">
            {/* 内容项目骨架屏 */}
            {[1, 2, 3].map((item) => (
                <div key={item} className="bg-surface-50 rounded-xl p-6 animate-pulse">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                                <div className="h-6 bg-surface-200 rounded w-3/4"></div>
                                <div className="h-5 bg-surface-200 rounded w-16"></div>
                            </div>
                            <div className="space-y-2 mb-3">
                                <div className="h-4 bg-surface-200 rounded w-full"></div>
                                <div className="h-4 bg-surface-200 rounded w-5/6"></div>
                                <div className="h-4 bg-surface-200 rounded w-4/6"></div>
                            </div>

                            <div className="flex flex-wrap gap-1 mb-3">
                                <div className="h-5 bg-surface-200 rounded w-16"></div>
                                <div className="h-5 bg-surface-200 rounded w-20"></div>
                                <div className="h-5 bg-surface-200 rounded w-16"></div>
                            </div>

                            <div className="flex items-center space-x-4 text-sm">
                                <div className="h-4 bg-surface-200 rounded w-10"></div>
                                <div className="h-4 bg-surface-200 rounded w-10"></div>
                                <div className="h-4 bg-surface-200 rounded w-20"></div>
                            </div>
                        </div>

                        <div className="flex-shrink-0 ml-4">
                            <div className="w-24 h-24 bg-surface-200 rounded-lg"></div>
                        </div>
                    </div>

                    <div className="h-10 bg-surface-200 rounded w-32"></div>
                </div>
            ))}
        </div>
    );
};

export default CoachContentSkeleton;