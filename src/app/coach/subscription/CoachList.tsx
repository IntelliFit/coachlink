import React, { useEffect, useState } from 'react';
import { Brain, MessageCircle, Star, Clock, Award, Users, BookOpen } from 'lucide-react';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Avatar } from 'primereact/avatar';
import { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';
import { useRouter } from 'next/navigation';
import { coachService } from '@/app/service/coachService';
import { GetAggregatedInfoResponseDto } from '@/app/api/coach/get-aggregated-info/entity';

// 定义订阅状态的类型
type SubscriptionStatus = {
  status: 'active' | 'expired' | 'expiring' | 'waiting' | 'inactive';
  text: string;
  color: 'success' | 'warning' | 'danger';
};

interface CoachListProps {
    subscriptions: QueryCoachSubscription[];
}

const CoachList: React.FC<CoachListProps> = ({ subscriptions }) => {

    const router = useRouter();
    const [aggregatedInfoMap, setAggregatedInfoMap] = useState<Record<string, GetAggregatedInfoResponseDto>>({});

    // 批量获取教练聚合信息
    useEffect(() => {
        const fetchAggregatedInfo = async () => {
            const infoMap: Record<string, GetAggregatedInfoResponseDto> = {};
            
            for (const sub of subscriptions) {
                try {
                    const res = await coachService.getAggregatedInfo({ coachId: sub.coach_id });
                    if (res) {
                        infoMap[sub.coach_id] = res;
                    }
                } catch (error) {
                    console.error(`获取教练 ${sub.coach_id} 聚合信息失败:`, error);
                }
            }
            
            setAggregatedInfoMap(infoMap);
        };

        if (subscriptions.length > 0) {
            fetchAggregatedInfo();
        }
    }, [subscriptions]);

    const getSubscriptionStatus = (subscription: QueryCoachSubscription): SubscriptionStatus => {
        // 优先按订阅状态展示（比 end_date 更直观，且能覆盖“待支付/待确认”等等待期）
        if (subscription.status === 'inactive') {
            return { status: 'inactive', text: '待支付', color: 'warning' };
        }
        if (subscription.status === 'waiting') {
            return { status: 'waiting', text: '等待教练确认', color: 'warning' };
        }

        if (!subscription.end_date) {
            return { status: 'active', text: '永久有效', color: 'success' };
        }

        const daysLeft = Math.ceil((new Date(subscription.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

        if (daysLeft <= 0) {
            return { status: 'expired', text: '已过期', color: 'danger' };
        }
        if (daysLeft <= 7) {
            return { status: 'expiring', text: `${daysLeft}天后过期`, color: 'warning' };
        }
        return { status: 'active', text: `${daysLeft}天后到期`, color: 'success' };
    };

        return (
            <div id="guide-subscription-list" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {subscriptions.map((subscription, idx) => {
                const status = getSubscriptionStatus(subscription);
                const coach = subscription.coach;
                const aggregatedInfo = aggregatedInfoMap[subscription.coach_id];
                
                // 获取专业领域
                const specialties = aggregatedInfo?.specialties?.length 
                    ? aggregatedInfo.specialties 
                    : (coach?.specialties || []);

                // 获取案例数量
                const profile = (coach?.profile || {}) as Record<string, any>;
                const caseStudyCount = Array.isArray(profile.caseStudies) ? profile.caseStudies.length : 0;
                
                return (
                    <div key={subscription.id} className="rounded-lg overflow-hidden shadow-sm border border-surface-200 hover:shadow-md transition-shadow">
                        {/* 顶部状态栏 */}
                        <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-3 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="text-surface text-sm font-medium">订阅等级 Tier {subscription.tier}</span>
                            </div>
                            <Tag value={status.text} severity={status.color as any} className="text-xs font-medium" />
                        </div>

                        {/* 教练信息主体 */}
                        <div className="p-6">
                            <div className="flex gap-6 mb-6">
                                {/* 左侧 - 头像 */}
                                <div className="flex-shrink-0">
                                    {coach?.avatar_url ? (
                                        <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-surface-200">
                                            <img
                                                src={coach.avatar_url}
                                                alt={coach.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <Avatar
                                            label={coach?.name?.substring(0, 1).toUpperCase() || 'C'}
                                            shape="circle"
                                            size="xlarge"
                                            className="text-3xl w-24 h-24 bg-gradient-to-r from-primary-500 to-red-600"
                                        />
                                    )}
                                </div>

                                {/* 右侧 - 基本信息 */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="text-xl font-bold text-surface-900 truncate">{coach?.name}</h3>
                                        {subscription.status === 'active' && (
                                            <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                已订阅
                                            </div>
                                        )}
                                {subscription.status === 'waiting' && (
                                    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                        待确认
                                    </div>
                                )}
                                {subscription.status === 'inactive' && (
                                    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                        待支付
                                    </div>
                                )}
                                    </div>
                                    {coach?.title && (
                                        <p className="text-sm text-surface-600 mb-3">{coach.title}</p>
                                    )}

                                    {/* 统计信息 */}
                                    <div className="flex flex-wrap gap-4 text-sm">
                                        <div className="flex items-center text-surface-600">
                                            <BookOpen className="w-4 h-4 mr-1" />
                                            <span className="font-medium text-surface-900">{aggregatedInfo?.contentCount || 0}</span>
                                            <span className="ml-1">内容</span>
                                        </div>
                                        <div className="flex items-center text-surface-600">
                                            <Users className="w-4 h-4 mr-1" />
                                            <span className="font-medium text-surface-900">{aggregatedInfo?.studentCount || 0}</span>
                                            <span className="ml-1">学员</span>
                                        </div>
                                        <div className="flex items-center text-surface-600">
                                            <Star className="w-4 h-4 mr-1 text-yellow-500" />
                                            <span className="font-medium text-surface-900">{aggregatedInfo?.averageRating?.toFixed(1) || '0.0'}</span>
                                            <span className="ml-1">评分</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 专业领域 */}
                            {specialties.length > 0 && (
                                <div className="mb-4">
                                    <h4 className="text-sm font-medium text-surface-700 mb-2">专业领域</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {specialties.slice(0, 6).map((specialty, index) => (
                                            <Tag key={index} value={specialty} rounded className="text-xs" />
                                        ))}
                                        {specialties.length > 6 && (
                                            <Tag value={`+${specialties.length - 6}`} rounded className="text-xs" />
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 教学经验和案例 */}
                            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                                <div>
                                    <h4 className="text-sm font-medium text-surface-700 mb-1">教学经验</h4>
                                    <p className="text-surface-600">
                                        {coach?.years_experience ? `${coach.years_experience}年专业经验` : '暂无信息'}
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium text-surface-700 mb-1">代表案例</h4>
                                    <p className="text-surface-600">
                                        {caseStudyCount > 0 ? `${caseStudyCount} 个案例` : '暂无案例'}
                                    </p>
                                </div>
                            </div>

                            {/* 教练简介 */}
                            {coach?.bio && (
                                <div className="mb-4">
                                    <h4 className="text-sm font-medium text-surface-700 mb-1">教练简介</h4>
                                    <p className="text-surface-600 text-sm line-clamp-2">
                                        {coach.bio}
                                    </p>
                                </div>
                            )}

                            {/* 操作按钮 */}
                            <div className="flex gap-2 pt-4 border-t border-surface-200">
                                <Button
                                    label="在线咨询"
                                    icon="pi pi-comments"
                                    size="small"
                                    outlined
                                    className="flex-1"
                                    id={idx === 0 ? "guide-subscription-chat" : undefined}
                                    onClick={() => router.push(`/messages?coachId=${subscription.coach_id}`)}
                                />
                                <Button
                                    label="查看详情"
                                    icon="pi pi-user"
                                    size="small"
                                    className="flex-1"
                                    onClick={() => router.push(`/coach/profile/${subscription.coach_id}`)}
                                />
                            </div>

                            {/* 等待期提示 */}
                            {subscription.status === 'waiting' && (
                                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <div className="text-sm font-medium text-yellow-900 mb-1">已提交支付信息</div>
                                    <div className="text-xs text-yellow-700">
                                        正在等待教练确认并下发训练计划。建议点击「在线咨询」补充你的目标与训练安排，加速计划制定。
                                    </div>
                                </div>
                            )}
                            {subscription.status === 'inactive' && (
                                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                    <div className="text-sm font-medium text-orange-900 mb-1">订阅未生效</div>
                                    <div className="text-xs text-orange-700">
                                        你的订阅流程尚未完成（通常是未支付或未提交凭证）。点击「查看详情」回到教练主页继续完成订阅。
                                    </div>
                                </div>
                            )}

                            {/* 续费提示 */}
                            {status.status === 'expiring' && (
                                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Clock className="w-4 h-4 text-orange-600" />
                                        <span className="text-sm font-medium text-orange-800">订阅即将到期</span>
                                    </div>
                                    <Button 
                                        label="立即续费" 
                                        size="small"
                                        className="w-full p-button-warning" 
                                        onClick={() => router.push(`/coach/profile/${subscription.coach_id}?renew=true`)}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

export default CoachList;
