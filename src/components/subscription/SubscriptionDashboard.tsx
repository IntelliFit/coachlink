import React, { useEffect, useState } from 'react';
import { Brain, Video, MessageCircle, Star, Clock, ArrowRight, Target, BarChart3 } from 'lucide-react';
import { coachSubscriptionService } from '@/app/service/subscriptionService';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Chip } from 'primereact/chip';
import { ProgressBar } from 'primereact/progressbar';
import { DataView } from 'primereact/dataview';

interface Coach {
    id: string;
    name: string;
    title: string;
    avatar_url?: string;
    specialties?: string[];
    rating?: number;
}

interface Subscription {
    id: string;
    coach: Coach;
    tier: number;
    start_date: string;
    end_date: string | null; // 允许为null，表示永久订阅
    is_active: boolean;
    auto_renew: boolean;
}

interface Activity {
    time: string;
    text: string;
}

interface SubscriptionStats {
    aiPlans: number;
    videoReviews: number;
    messages: number;
    trainingDays: number;
}

interface SubscriptionDashboardProps {
    subscriptions: Subscription[];
    onAccessService: (serviceType: string, coachId: string) => void;
    userId?: string;
}

const SubscriptionDashboard: React.FC<SubscriptionDashboardProps> = ({
    subscriptions,
    onAccessService,
    userId
}) => {
    // 统计与动态
    const [stats, setStats] = useState<SubscriptionStats>({ aiPlans: 0, videoReviews: 0, messages: 0, trainingDays: 0 });
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            if (!userId) {
                setLoading(false);
                return;
            }
            
            try {
                const data = await coachSubscriptionService.getUserStats(userId);
                if (data) {
                    setStats(data.stats);
                    setActivities(data.activities);
                }
            } catch (e) {
                console.error('加载统计数据失败:', e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [userId]);

    const getServicesByTier = (tier: number) => {
        const base = [
            { id: 'ai_plan', name: 'AI训练计划', description: '个性化AI训练方案', icon: Brain, color: 'bg-blue-500', available: tier >= 1 }
        ];
        if (tier >= 3) {
            base.push({ id: 'chat', name: '一对一聊天', description: '与教练实时沟通交流', icon: MessageCircle, color: 'bg-purple-500', available: true });
        } else {
            base.push({ id: 'chat_demo', name: '🎯 体验聊天功能', description: '免费体验一对一聊天 (演示版)', icon: MessageCircle, color: 'bg-orange-500', available: true });
        }
        return base;
    };

    const getSubscriptionStatus = (subscription: Subscription) => {
        // 如果没有结束日期，表示永久订阅
        if (!subscription.end_date) {
            return { status: 'active', text: '永久有效', color: 'text-green-600 bg-green-50' };
        }

        const daysLeft = Math.ceil((new Date(subscription.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

        if (daysLeft <= 0) {
            return { status: 'expired', text: '已过期', color: 'text-red-600 bg-red-50' };
        } else if (daysLeft <= 7) {
            return { status: 'expiring', text: `${daysLeft}天后过期`, color: 'text-orange-600 bg-orange-50' };
        } else {
            return { status: 'active', text: `${daysLeft}天后到期`, color: 'text-green-600 bg-green-50' };
        }
    };

    const renderStatItem = (icon: React.ElementType, value: number, label: string, color: string) => {
        const Icon = icon;
        return (
            <div className="p-4">
                <div className={`w-12 h-12 ${color} rounded-full flex items-center justify-center mx-auto mb-3`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
                <div className="text-sm text-gray-600">{label}</div>
            </div>
        );
    };

    const renderActivityItem = (activity: Activity) => {
        return (
            <div className="flex items-center p-3 border-b border-gray-200 last:border-b-0">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                    <Target className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{activity.text}</div>
                    <div className="text-xs text-gray-500">{new Date(activity.time).toLocaleString()}</div>
                </div>
            </div>
        );
    };

    if (subscriptions.length === 0) {
        return (
            <div className="text-center py-12">
                <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">还没有订阅任何教练</h3>
                <p className="text-gray-600 mb-6">选择专业教练，开始您的健身之旅</p>
                <Button 
                    label="浏览教练" 
                    onClick={() => onAccessService('browse_coaches', '')}
                    className="p-button-primary"
                />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* 订阅概览 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {subscriptions.map((subscription) => {
                    const status = getSubscriptionStatus(subscription);
                    const services = getServicesByTier(subscription.tier);
                    const availableServices = services.filter(s => s.available);

                    const header = (
                        <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-6 text-white">
                            <div className="flex items-center space-x-4">
                                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                                    <span className="text-xl font-bold">{subscription.coach.name.charAt(0)}</span>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold">{subscription.coach.name}</h3>
                                    <p className="text-blue-100 text-sm">{subscription.coach.title}</p>
                                    <div className="flex items-center space-x-1 mt-1">
                                        <Star className="w-4 h-4 text-yellow-300 fill-current" />
                                        <span className="text-sm">{subscription.coach.rating || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-blue-100">订阅等级</div>
                                    <div className="text-lg font-bold">Tier {subscription.tier}</div>
                                </div>
                                <Chip label={status.text} className={status.color} />
                            </div>
                        </div>
                    );

                    return (
                        <Card key={subscription.id} header={header} className="shadow-sm border border-gray-200">
                            <div className="p-6">
                                <h4 className="text-sm font-semibold text-gray-700 mb-4">可用服务</h4>
                                <div className="space-y-3">
                                    {availableServices.map((service) => {
                                        const Icon = service.icon;
                                        return (
                                            <Button
                                                key={service.id}
                                                onClick={() => onAccessService(service.id, subscription.coach.id)}
                                                className="w-full flex items-center p-3 bg-gray-50 hover:bg-gray-100 justify-start"
                                                text
                                            >
                                                <div className={`w-10 h-10 ${service.color} rounded-lg flex items-center justify-center`}>
                                                    <Icon className="w-5 h-5 text-white" />
                                                </div>
                                                <div className="flex-1 text-left ml-3">
                                                    <div className="text-sm font-medium text-gray-900">{service.name}</div>
                                                    <div className="text-xs text-gray-500">{service.description}</div>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-gray-400" />
                                            </Button>
                                        );
                                    })}
                                </div>

                                {/* 续费提醒 */}
                                {status.status === 'expiring' && (
                                    <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                        <div className="flex items-center space-x-2">
                                            <Clock className="w-4 h-4 text-orange-600" />
                                            <span className="text-sm text-orange-800">订阅即将到期</span>
                                        </div>
                                        <Button 
                                            label="立即续费" 
                                            className="mt-2 w-full p-button-warning"
                                        />
                                    </div>
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* 快速统计 */}
            <Card title="训练统计" className="shadow-sm">
                {loading ? (
                    <ProgressBar mode="indeterminate" className="h-1" />
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {renderStatItem(Brain, stats.aiPlans, 'AI训练计划', 'bg-blue-100')}
                        {renderStatItem(Video, stats.videoReviews, '视频点评', 'bg-green-100')}
                        {renderStatItem(MessageCircle, stats.messages, '聊天消息', 'bg-purple-100')}
                        {renderStatItem(BarChart3, stats.trainingDays, '训练天数', 'bg-orange-100')}
                    </div>
                )}
            </Card>

            {/* 最近活动 */}
            <Card title="最近活动" className="shadow-sm">
                {loading ? (
                    <ProgressBar mode="indeterminate" className="h-1" />
                ) : activities.length === 0 ? (
                    <div className="text-center text-gray-500 py-4">暂无活动</div>
                ) : (
                    <DataView value={activities} itemTemplate={renderActivityItem} />
                )}
            </Card>
        </div>
    );
};

export default SubscriptionDashboard;