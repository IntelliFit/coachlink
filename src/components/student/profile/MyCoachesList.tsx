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
                        label="发现" 
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
                                    ? (!coach.has_plan_instance ? 'bg-primary-100 text-primary-700'
                                        : (!coach.start_date ? 'bg-surface-100 text-surface-700'
                                            : 'bg-green-100 text-green-700'))
                                    : 'bg-surface-100 text-surface-600'
                            }`}>
                                {coach.status === 'active'
                                    ? (!coach.has_plan_instance ? '制定中'
                                        : (!coach.start_date ? '未开始' : '服务中'))
                                    : '已过期'}
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
                                Number(coach.tier) === 3 ? 'bg-amber-100 text-amber-700' :
                                Number(coach.tier) === 2 ? 'bg-blue-100 text-blue-700' :
                                Number(coach.tier) === 1 ? 'bg-green-100 text-green-700' :
                                'bg-surface-100 text-surface-600'
                            }`}>
                                <Star size={14} className="text-yellow-500 fill-yellow-500" />
                                <span>{Number(coach.tier) === 1 ? '特惠版' : Number(coach.tier) === 2 ? '专业指导版' : Number(coach.tier) === 3 ? '全能指导版' : `套餐 ${coach.tier}`}</span>
                            </div>
                            <div className={`text-xs ${
                                coach.status === 'completed' ? 'text-green-600' : 'text-surface-500'
                            }`}>
                                {coach.subscribed_weeks && <span className="mr-2">共{coach.subscribed_weeks}周</span>}
                                {(() => {
                                    if (coach.status === 'completed') {
                                        return '已完成';
                                    }
                                    if (coach.status === 'active' && !coach.has_plan_instance) {
                                        return '教练正在制定计划';
                                    }
                                    if (coach.status === 'active' && coach.has_plan_instance && !coach.start_date) {
                                        return '计划已下发，等待开始训练';
                                    }
                                    if (coach.end_date) {
                                        const endDate = new Date(coach.end_date);
                                        const now = new Date();
                                        if (endDate < now) {
                                            return '已完成';
                                        }
                                        const dateStr = endDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
                                        return `预计 ${dateStr} 完成`;
                                    }
                                    return '进行中';
                                })()}
                            </div>
                        </div>

                        <div className="flex gap-2 mt-4">
                            <Button 
                                label="查看主页" 
                                className="flex-1 p-button-sm p-button-outlined" 
                                onClick={() => router.push(`/coach/profile/${coach.coach?.id}`)}
                            />
                            {coach.status === 'active' && (
                                <Button 
                                    label="续费" 
                                    className="flex-1 p-button-sm p-button-outlined p-button-secondary" 
                                    onClick={() => router.push(`/coach/profile/${coach.coach?.id}?renew=true`)}
                                />
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};