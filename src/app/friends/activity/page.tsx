'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { ProgressSpinner } from 'primereact/progressspinner';
import { friendService } from '@/app/service/friendService';
import { ActivityCard } from '@/components/social/ActivityCard';
import { Users } from 'lucide-react';

export default function FriendActivityPage() {
    const router = useRouter();
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadActivities();
    }, []);

    const loadActivities = async () => {
        try {
            const res = await friendService.getActivity();
            if (res.success) {
                setActivities(res.data?.activities || []);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-surface-50 pb-24">
            {/* Header w/ Friend Link */}
            <div className="sticky top-0 z-10 shadow-sm px-4 py-3 flex items-center justify-between bg-surface-0/95 backdrop-blur-md border-b border-surface-100">
                <h1 className="text-lg font-bold text-surface-900">好友动态</h1>
                <Button 
                    icon={<Users className="w-5 h-5 mr-1" />} 
                    label="好友列表"
                    text 
                    size="small"
                    onClick={() => router.push('/friends')} 
                />
            </div>

            <div className="p-4">
                {loading ? (
                    <div className="flex justify-center p-8"><ProgressSpinner style={{width: '30px'}}/></div>
                ) : activities.length === 0 ? (
                    <div className="text-center py-12 text-surface-500">
                        <div className="mb-4 text-4xl">📭</div>
                        <p>暂无好友动态</p>
                        <p className="text-sm mt-2 mb-4">快去添加好友，看看大家都在练什么！</p>
                        <Button 
                            label="去添加好友" 
                            outlined 
                            onClick={() => router.push('/friends')}
                        />
                    </div>
                ) : (
                    <div className="animate-fade-in">
                        {activities.map(activity => (
                            <ActivityCard key={activity.id} activity={activity} />
                        ))}
                        
                        <div className="text-center py-4 text-xs text-surface-400">
                            - 暂无更多 -
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
