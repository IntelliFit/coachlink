import React from 'react';
import { Tag } from 'primereact/tag';

interface StatusInfoComponentProps {
    status?: string;
}

export const StatusInfoComponent: React.FC<StatusInfoComponentProps> = ({ status }) => {
    const severity = status === 'active' ? 'success' :
        status === 'waiting' ? 'warning' :
            status === 'inactive' ? 'danger' : 'info';
    
    const label = status === 'active' ? '已激活' :
        status === 'waiting' ? '等待确认' :
            status === 'inactive' ? '未支付' : status;

    return <Tag severity={severity} value={label} />;
};