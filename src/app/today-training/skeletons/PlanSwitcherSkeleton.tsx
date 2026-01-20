'use client';

import React from 'react';
import { Skeleton } from 'primereact/skeleton';

const PlanSwitcherSkeleton: React.FC = () => {
    return (
        <div className="grid grid-cols-2 gap-2 p-1 bg-surface-50 rounded-2xl mb-6 w-full sm:w-fit">
            <Skeleton width="100px" height="2.5rem" className="bg-surface-100/50 rounded-lg" />
            <Skeleton width="100px" height="2.5rem" className="bg-surface-100/50 rounded-lg" />
        </div>
    );
};

export default PlanSwitcherSkeleton;
