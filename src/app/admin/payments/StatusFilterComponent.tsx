import React from 'react';
import { Dropdown } from 'primereact/dropdown';
import { Tag } from 'primereact/tag';

interface StatusFilterComponentProps {
    options: any;
}

export const statusTemplate = (status: string) => {
    if (!status) {
        return (
            <span>选择状态</span>
        )
    }

    const severity = status === 'active' ? 'success' :
        status === 'waiting' ? 'warning' :
            status === 'inactive' ? 'danger' : 'info';

    const label = status === 'active' ? '已激活' :
        status === 'waiting' ? '等待确认' :
            status === 'inactive' ? '未支付' : status;

    return (
        <Tag severity={severity} value={label} />
    );
};

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
            placeholder='选择状态'
            className="p-column-filter"
            itemTemplate={option => statusTemplate(option?.value)}
            valueTemplate={() => statusTemplate(options?.value)}
            showClear
        />
    );
};