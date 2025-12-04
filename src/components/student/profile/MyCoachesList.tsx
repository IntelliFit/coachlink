import React, { useEffect, useState } from 'react';
import { Users, ChevronRight, Star } from 'lucide-react';
import { Avatar } from 'primereact/avatar';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { subscriptionService } from '@/app/service/subscriptionService';
import { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';

interface MyCoachesListProps {
}

export const MyCoachesList: React.FC<MyCoachesListProps> = ({}) => {
    const router = useRouter();
    const { data: session } = useSession();
    const [coachesData, setCoachesData] = useState<QueryCoachSubscription[]>([]);
    const [loading, setLoading] = useState(true);
    
    const load = async () => {
        setLoading(true);
        try {
            const res = await subscriptionService.getCoachSubscriptions({ studentId: session?.user.id || '' });
            if (res) {
                setCoachesData(res.subscriptions || []);
            }
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (session?.user.id) {
            load();
        }
    }, [session]);

    // 渲染骨架屏组件
    const renderSkeleton = () => {
        return (
            <>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Skeleton shape="circle" size="2rem" className="mr-2" />
                        <Skeleton width="100px" height="2rem" />
                    </div>
                    <Skeleton width="80px" height="2rem" />
                </div>
                
                <div className="space-y-4">
                    {[1, 2].map((item) => (
                        <div key={item} className="p-4 rounded-xl border border-surface-100 bg-surface-50">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <Skeleton shape="circle" size="3rem" />
                                    <div>
                                        <Skeleton width="80px" height="1.25rem" className="mb-2" />
                                        <Skeleton width="60px" height="0.75rem" />
                                    </div>
                                </div>
                                <Skeleton width="60px" height="1.5rem" />
                            </div>
                            
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-1">
                                    <Skeleton width="60px" height="0.875rem" />
                                </div>
                                <Skeleton width="80px" height="0.875rem" />
                            </div>
                            
                            <Skeleton width="100%" height="2rem" />
                        </div>
                    ))}
                </div>
            </>
        );
    };

    if (loading) {
        return (
            <div className="bg-surface rounded-2xl shadow-sm p-6 mb-6">
                <h2 className="text-lg font-bold text-surface-900 flex items-center gap-2 mb-4">
                    <Users className="text-primary" size={20} />
                    我的教练
                </h2>
                {renderSkeleton()}
            </div>
        );
    }

    if (!coachesData || coachesData.length === 0) {
        return (
            <div className="bg-surface rounded-2xl shadow-sm p-6 mb-6">
                <h2 className="text-lg font-bold text-surface-900 flex items-center gap-2 mb-4">
                    <Users className="text-primary" size={20} />
                    我的教练
                </h2>
                <div className="text-center py-8 bg-surface-50 rounded-xl border border-dashed border-surface-200">
                    <p className="text-surface-500 mb-4">暂无订阅的教练</p>
                    <Button 
                        label="发现教练" 
                        icon="pi pi-search" 
                        size="small" 
                        onClick={() => router.push('/coach/discovery')}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-surface rounded-2xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                    <Users className="text-primary" size={20} />
                    我的教练
                </h2>
                <Button 
                    label="发现更多" 
                    icon="pi pi-arrow-right" 
                    text
                    iconPos="right"
                    onClick={() => router.push('/coach/discovery')}
                />
            </div>

            <div className="space-y-4">
                {coachesData.map((coach) => (
                    <div key={coach.id} className="p-4 rounded-xl border border-surface-100 hover:shadow-md transition-shadow bg-surface-50">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <Avatar 
                                    image={coach.coach?.avatar_url || undefined} 
                                    label={!coach.coach?.avatar_url ? (coach.coach?.name?.charAt(0) || 'C') : undefined}
                                    shape="circle" 
                                    size="large"
                                    className="bg-primary-100 text-primary font-bold"
                                />
                                <div>
                                    <h3 className="font-bold text-surface-900">{coach.coach?.name || '未知教练'}</h3>
                                    <p className="text-xs text-surface-500">{coach.coach?.title || '专业教练'}</p>
                                </div>
                            </div>
                            <div className={`px-2 py-1 rounded text-xs font-medium ${
                                coach.status === 'active' 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-surface-100 text-surface-600'
                            }`}>
                                {coach.status === 'active' ? '服务中' : '已过期'}
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-1 text-surface-600">
                                <Star size={14} className="text-yellow-500 fill-yellow-500" />
                                <span>Tier {coach.tier}</span>
                            </div>
                            <div className="text-surface-500 text-xs">
                                到期: {coach.end_date ? new Date(coach.end_date).toLocaleDateString() : '长期有效'}
                            </div>
                        </div>

                        <Button 
                            label="查看主页" 
                            className="w-full mt-4 p-button-sm p-button-outlined" 
                            onClick={() => router.push(`/coach/profile/${coach.coach?.id}`)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};