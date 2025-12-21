import React from 'react';
import { Dropdown } from 'primereact/dropdown';

interface StatusFilterComponentProps {
    options: any;
}

export const StatusFilterComponent: React.FC<StatusFilterComponentProps> = ({ options }) => {
    const statusOptions = [
        { label: '未支付', value: 'inactive' },
        { label: '等待确认', value: 'waiting' },
        { label: '已激活', value: 'active' }
    ];

    return (
        <Dropdown
            value={options.value}
            options={statusOptions}
            onChange={(e) => {
                options.filterApplyCallback(e.value);
            }}
            placeholder="选择状态"
            className="p-column-filter"
            showClear
        />
    );
};