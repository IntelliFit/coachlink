import React from 'react';
import { Dropdown } from 'primereact/dropdown';

interface TierFilterComponentProps {
    options: any;
}

export const tierTemplate = (tier: number) => {
    if (!tier) {
        return (
            <span>选择等级</span>
        )
    }

    return (
        <span className="px-2 py-1 bg-primary text-surface rounded-full text-sm">
            等级 {tier}
        </span>
    );
};


export const TierFilterComponent: React.FC<TierFilterComponentProps> = ({ options }) => {
    const tierOptions = [
        { label: '等级 1', value: 1 },
        { label: '等级 2', value: 2 },
        { label: '等级 3', value: 3 }
    ];

    return (
        <Dropdown
            value={options.value}
            options={tierOptions}
            onChange={(e) => {
                options.filterApplyCallback(e.value);
            }}
            placeholder="选择等级"
            className="p-column-filter"
            itemTemplate={option => tierTemplate(option?.value)}
            valueTemplate={() => tierTemplate(options.value)}
            showClear
        />
    );
};