'use client';

import React from 'react';
import { Timeline } from 'primereact/timeline';
import { Card } from 'primereact/card';

interface Activity {
    status: string;
    date: string;
}

interface RecentActivitiesProps {
    className?: string;
}

const RecentActivities: React.FC<RecentActivitiesProps> = ({ className = '' }) => {
    const activities: Activity[] = [
        {
            status: '张小明 上传了新的训练视频',
            date: '2小时前',
        },
        {
            status: '李小红 发送了新消息',
            date: '4小时前',
        },
        {
            status: '王小刚 给您的点评点赞',
            date: '6小时前',
        }
    ];

    const opposite = (item: Activity) => {
        return <small className="text-gray-500">{item.date}</small>;
    };

    const content = (item: Activity) => (
        <div>
            <p className="text-gray-900">{item.status}</p>
        </div>
    );

    return (
        <Card title="最近活动" className={className}>
            <Timeline 
                value={activities} 
                opposite={opposite}
                content={content}
                className="customized-timeline"
            />
        </Card>
    );
};

export default RecentActivities;