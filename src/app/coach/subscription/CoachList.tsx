import React from 'react';
import { Brain, MessageCircle, Star, Clock, ArrowRight } from 'lucide-react';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';
import { useRouter } from 'next/navigation';

// 定义订阅状态的类型
type SubscriptionStatus = {
  status: 'active' | 'expired' | 'expiring';
  text: string;
  color: 'success' | 'warning' | 'danger';
};

interface CoachListProps {
    subscriptions: QueryCoachSubscription[];
}

const CoachList: React.FC<CoachListProps> = ({ subscriptions }) => {

    const router = useRouter();

    const getServicesByTier = (tier: number) => {
        const base = [
            { id: 'ai_plan', name: '训练计划', desc: '获取教练专属训练计划', icon: Brain, color: 'bg-blue-500', available: tier >= 1 }
        ]
        if (tier >= 3)
            base.push({ id: 'chat', name: '一对一聊天', desc: '与教练实时沟通交流', icon: MessageCircle, color: 'bg-purple-500', available: true })
        else
            base.push({ id: 'chat_demo', name: '🎯 体验聊天功能', desc: '免费体验一对一聊天 (演示版)', icon: MessageCircle, color: 'bg-primary-500', available: true })
        return base
    }


    const onAccessService = (serviceId: string, coachId: string) => {

        switch (serviceId) {
            case 'ai_plan':
                router.push(`/coach/plans?coachId=${coachId}`, { scroll: true });
                break;
        
            default:
                break;
        }
    }

    const getSubscriptionStatus = (subscription: QueryCoachSubscription): SubscriptionStatus => {
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subscriptions.map(subscription => {
                const status = getSubscriptionStatus(subscription);
                const available = getServicesByTier(subscription.tier).filter(x => x.available)
                
                return (
                    <div key={subscription.id} className="rounded-lg overflow-hidden p-card">
                        <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-6 text-surface">
                            <div className="flex items-center space-x-4">
                                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                                    <span className="text-xl font-bold">{subscription.coach?.name.charAt(0)}</span>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold">{subscription.coach?.name}</h3>
                                    <p className="text-primary-100 text-sm">{subscription.coach?.title}</p>
                                    <div className="flex items-center space-x-1 mt-1">
                                        <Star className="w-4 h-4 text-yellow-300 fill-current" />
                                        <span className="text-sm">{subscription.coach?.rating}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-primary-100">订阅等级</div>
                                    <div className="text-lg font-bold">Tier {subscription.tier}</div>
                                </div>
                                <Tag value={status.text} severity={status.color as any} className="text-xs font-medium px-3 py-1" />
                            </div>
                        </div>
                        <div className="p-6">
                            <h4 className="text-sm font-semibold text-gray-700 mb-4 dark:text-gray-300">可用服务</h4>
                            <div className="space-y-3">
                                {available.map(service => {
                                    const Icon = service.icon
                                    return (
                                        <div
                                            key={service.id}
                                            onClick={() => onAccessService(service.id, subscription.coach_id)}
                                            className="w-full justify-start p-button-text text-left p-3 rounded-lg cursor-pointer
                                                flex items-center space-x-3 hover:bg-primary-100 bg-surface-100"
                                        >
                                            <div className={`w-10 h-10 ${service.color} rounded-lg flex items-center justify-center`}>
                                                <Icon className="w-5 h-5 text-surface" />
                                            </div>
                                            <div className="flex-1 text-left">
                                                <div className="text-sm font-medium">{service.name}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">{service.desc}</div>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-gray-400" />
                                        </div>
                                    )
                                })}
                            </div>
                            {status.status === 'expiring' && (
                                <div className="mt-4 p-3 bg-primary-50 border border-primary-200 rounded-lg dark:bg-primary-900 dark:border-primary-700">
                                    <div className="flex items-center space-x-2">
                                        <Clock className="w-4 h-4 text-primary-600 dark:text-primary-300" />
                                        <span className="text-sm text-primary-800 dark:text-primary-200">订阅即将到期</span>
                                    </div>
                                    <Button label="立即续费" className="mt-2 w-full p-button-primary text-sm" />
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