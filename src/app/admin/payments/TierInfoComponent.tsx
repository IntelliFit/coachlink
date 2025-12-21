import React from 'react';

interface TierInfoComponentProps {
    tier?: number;
}

export const TierInfoComponent: React.FC<TierInfoComponentProps> = ({ tier }) => {
    return (
        <span className="px-2 py-1 bg-primary text-surface rounded-full text-sm">
            等级 {tier}
        </span>
    );
};