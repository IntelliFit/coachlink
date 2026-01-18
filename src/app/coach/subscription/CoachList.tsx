import React, { useEffect, useState } from 'react';
import { MessageCircle, Clock, ArrowRight } from 'lucide-react';
import { Avatar } from 'primereact/avatar';
import { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';
import { useRouter } from 'next/navigation';
import { coachService } from '@/app/service/coachService';
import { GetAggregatedInfoResponseDto } from '@/app/api/coach/get-aggregated-info/entity';

const STATUS_THEME: Record<string, { bg: string, text: string, label: string }> = {
    active: { bg: 'bg-emerald-50', text: 'text-emerald-600', label: '已激活' },
    preparing: { bg: 'bg-primary-50', text: 'text-primary-600', label: '制定中' },
    not_started: { bg: 'bg-surface-50', text: 'text-surface-600', label: '未开始' },
    expired: { bg: 'bg-slate-100', text: 'text-slate-500', label: '已过期' },
    expiring: { bg: 'bg-amber-50', text: 'text-amber-600', label: '即将到期' },
    waiting: { bg: 'bg-primary-50', text: 'text-primary-600', label: '待确认' },
    inactive: { bg: 'bg-rose-50', text: 'text-rose-600', label: '待支付' },
};

interface CoachListProps {
    subscriptions: QueryCoachSubscription[];
}

const CoachList: React.FC<CoachListProps> = ({ subscriptions }) => {
    const router = useRouter();
    const [aggregatedInfoMap, setAggregatedInfoMap] = useState<Record<string, GetAggregatedInfoResponseDto>>({});

    useEffect(() => {
        const fetchAggregatedInfo = async () => {
            const infoMap: Record<string, GetAggregatedInfoResponseDto> = {};
            for (const sub of subscriptions) {
                try {
                    const res = await coachService.getAggregatedInfo({ coachId: sub.coach_id });
                    if (res) infoMap[sub.coach_id] = res;
                } catch (error) { console.error(error); }
            }
            setAggregatedInfoMap(infoMap);
        };
        if (subscriptions.length > 0) fetchAggregatedInfo();
    }, [subscriptions]);

    const getStatusKey = (sub: QueryCoachSubscription) => {
        if (sub.status === 'inactive') return 'inactive';
        if (sub.status === 'waiting') return 'waiting';
        if (sub.status === 'active') {
            // active but coach hasn't assigned plan yet
            if ((sub as any).has_plan_instance === false) return 'preparing';
            // plan assigned but student hasn't started training yet
            if (!sub.start_date) return 'not_started';
            // started but no estimated end_date yet
            if (!sub.end_date) return 'active';
        }
        if (!sub.end_date) return 'active';
        const days = Math.ceil((new Date(sub.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        if (days <= 0) return 'expired';
        if (days <= 7) return 'expiring';
        return 'active';
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
            {subscriptions.map((subscription) => {
                const statusKey = getStatusKey(subscription);
                const theme = STATUS_THEME[statusKey];
                const coach = subscription.coach;
                const aggregatedInfo = aggregatedInfoMap[subscription.coach_id];
                const specialties = aggregatedInfo?.specialties?.length ? aggregatedInfo.specialties : (coach?.specialties || []);
                
                // 计算天数
                const daysLeft = subscription.end_date 
                    ? Math.ceil((new Date(subscription.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                    : null;

                return (
                    <div key={subscription.id} className="bg-surface rounded-[24px] border border-surface-100 transition-all overflow-hidden">
                        <div className="p-6">
                            {/* 头部：包含剩余天数显示 */}
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex gap-4">
                                    <div className="relative">
                                        {coach?.avatar_url ? (
                                            <img src={coach.avatar_url} alt={coach.name} className="w-16 h-16 rounded-[20px] object-cover ring-4 ring-surface-50 shadow-sm" />
                                        ) : (
                                            <Avatar label={coach?.name?.substring(0, 1).toUpperCase()} shape="circle" className="w-16 h-16 rounded-[20px] bg-surface-100 text-surface-400 font-bold" />
                                        )}
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-surface rounded-full flex items-center justify-center shadow-sm border border-surface-50">
                                            <div className={`w-2.5 h-2.5 rounded-full ${statusKey === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-surface-300'}`} />
                                        </div>
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-xl font-black text-surface-900 tracking-tight truncate leading-tight">{coach?.name}</h3>
                                        <p className="text-[11px] font-bold text-surface-500/60 mt-1 uppercase tracking-widest">{coach?.title || '专业认证教练'}</p>
                                    </div>
                                </div>

                                {/* 动态状态标签：显示剩余天数或状态名 */}
                                <div className={`px-3 py-1 rounded-full text-[10px] font-black tracking-tighter ${theme.bg} ${theme.text}`}>
                                    {statusKey === 'active' && daysLeft !== null 
                                        ? <>剩余 <span className="text-[12px]">{daysLeft}</span> 天</>
                                        : theme.label.toUpperCase()
                                    }
                                </div>
                            </div>

                            {/* 指标卡 */}
                            <div className="grid grid-cols-3 gap-px bg-surface-100 border border-surface-100 rounded-2xl overflow-hidden mb-6">
                                <div className="bg-surface p-3 text-center">
                                    <p className="text-[10px] text-surface-400 font-bold mb-0.5">内容</p>
                                    <p className="text-lg font-black text-surface-900 tracking-tighter">{aggregatedInfo?.contentCount || 0}</p>
                                </div>
                                <div className="bg-surface p-3 text-center">
                                    <p className="text-[10px] text-surface-400 font-bold mb-0.5">学员</p>
                                    <p className="text-lg font-black text-surface-900 tracking-tighter">{aggregatedInfo?.studentCount || 0}</p>
                                </div>
                                <div className="bg-surface p-3 text-center">
                                    <p className="text-[10px] text-surface-400 font-bold mb-0.5">评分</p>
                                    <p className="text-lg font-black text-primary-600 tracking-tighter">{aggregatedInfo?.averageRating?.toFixed(1) || '0.0'}</p>
                                </div>
                            </div>

                            {/* 专业领域 */}
                            <div className="flex flex-wrap gap-1.5 mb-5">
                                {specialties.slice(0, 4).map((s, i) => (
                                    <span key={i} className="px-2.5 py-1 bg-surface-50 text-surface-600 text-[11px] font-semibold rounded-lg border border-surface-100/50">{s}</span>
                                ))}
                            </div>

                            {coach?.bio && <p className="text-sm text-surface-500 leading-relaxed line-clamp-2 mb-6 min-h-[40px]">{coach.bio}</p>}

                            {/* 交互按钮 */}
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => {/* 咨询逻辑 */}}
                                    className="w-12 h-12 flex items-center justify-center rounded-2xl bg-surface-50 text-surface-600 border border-surface-100 transition-all active:scale-[0.95]"
                                >
                                    <MessageCircle className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={() => router.push(`/coach/profile/${subscription.coach_id}`)}
                                    className="flex-1 h-12 flex items-center justify-center gap-2 rounded-2xl bg-primary-600 text-surface text-sm font-black transition-all active:scale-[0.98] shadow-lg shadow-primary-100 dark:shadow-primary-800"
                                >
                                    <span>查看详情</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>

                            {/* 到期提醒提示 */}
                            {statusKey === 'expiring' && (
                                <div className="mt-5 p-4 rounded-2xl border border-amber-100 bg-amber-50/50 flex items-start gap-3">
                                    <Clock className="w-4 h-4 mt-0.5 text-amber-500" />
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-amber-700">即将于 {daysLeft} 天后到期</p>
                                        <p className="text-[11px] text-surface-500 mt-1">续费可继续享受该教练的专业指导。</p>
                                    </div>
                                    <button onClick={() => router.push(`/coach/profile/${subscription.coach_id}?renew=true`)} className="text-xs font-black text-amber-600 underline underline-offset-4">立即续费</button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default CoachList;