import React from 'react';
import { Brain, MessageCircle, Star, Clock } from 'lucide-react';
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
                const hasChatService = subscription.tier >= 3;
                
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
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">教练服务</h4>
                                {/* 在线咨询按钮 */}
                                <Button
                                    label="在线咨询"
                                    icon="pi pi-comments"
                                    size="small"
                                    outlined
                                    className="p-button-sm"
                                    onClick={() => router.push(`/messages?coachId=${subscription.coach_id}`)}
                                    tooltip={hasChatService ? "一对一实时聊天" : "体验聊天功能（演示版）"}
                                    tooltipOptions={{ position: 'top' }}
                                />
                            </div>
                            
                            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                                <div className="flex items-center space-x-2">
                                    <Brain className="w-4 h-4 text-primary-500" />
                                    <span>专属训练计划</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <MessageCircle className="w-4 h-4 text-purple-500" />
                                    <span>{hasChatService ? '一对一实时聊天' : '体验版聊天功能'}</span>
                                </div>
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
