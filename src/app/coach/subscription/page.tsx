'use client';

import React, { useEffect, useState } from 'react'
import { Brain, Video, MessageCircle, Star, Clock, ArrowRight, Target, BarChart3 } from 'lucide-react'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { Divider } from 'primereact/divider'
import { subscriptionService } from '@/app/service/subscriptionService'
import { useSession } from 'next-auth/react'
import { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity'
import { useRouter } from 'next/navigation';

const SubscriptionDashboard = () => {

    const { data: session } = useSession();
    const router = useRouter();

    const [stats, setStats] = useState({ aiPlans: 0, videoReviews: 0, messages: 0, trainingDays: 0 });
    const [activities, setActivities] = useState<Array<{ time: string; text: string }>>([]);
    const [subscriptions, setSubscriptions] = useState<QueryCoachSubscription[]>([]);

    useEffect(() => {
        // 仅当 session 存在时发起请求
        if (!session?.user?.id) return;

        const fetchSubscriptions = async () => {
            try {
                const subscriptionsResponse = await subscriptionService.getCoachSubscriptions({
                    studentId: session.user.id,
                });
                setSubscriptions(subscriptionsResponse?.subscriptions || []);
            } catch (error) {
                console.error("加载订阅信息失败:", error);
            }
        };

        fetchSubscriptions();
    }, [session?.user?.id]); // 依赖 session id

    const onAccessService = (serviceId: string, coachId: string) => {
        console.log('serviceId:', serviceId);
        console.log('coachId:', coachId);
    }


    useEffect(() => {
        const load = async () => {

            try {
                const [plans, videoStats, msgs] = await Promise.all([
                    subscriptionService.getTrainingPlans(),
                    subscriptionService.getVideoStats(),
                    subscriptionService.coachMessages()
                ])

                const aiPlans = (plans?.plans || []).filter((p: any) => p.ai_generated).length
                const messages = (msgs?.total as number) || 0

                const days = new Set<string>();
                (plans?.plans || []).forEach((p: any) => days.add(new Date(p.created_at).toDateString()))


                setStats({
                    aiPlans,
                    videoReviews: Math.max(0, Math.round(videoStats?.reviewed || 0)),
                    messages,
                    trainingDays: days.size
                })
                const recent: Array<{ time: string; text: string }> = [];
                (plans?.plans || []).slice(0, 3).forEach((p: any) =>
                    recent.push({ time: p.created_at, text: `创建了新的训练计划《${p.title || '训练计划'}》` })
                );


                // const userVideos = await videoService.getUserVideoSubmissions();
                // (userVideos || []).forEach((v: any) => days.add(new Date(v.submitted_at).toDateString()));
                // (userVideos || []).slice(0, 3).forEach((v: any) =>
                //     recent.push({ time: v.submitted_at, text: `上传了训练视频（${v.exercise_type || '训练'}）` })
                // );

                const msgsData = (msgs?.messages as any[]) || []
                msgsData.slice(0, 3).forEach((m: any) => recent.push({ time: m.created_at, text: '发送/收到了一条私信' }))
                recent.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
                setActivities(recent.slice(0, 5))
            } catch {
                setStats({ aiPlans: 0, videoReviews: 0, messages: 0, trainingDays: 0 })
                setActivities([])
            }
        }
        load()
    }, [session?.user.id])

    const getServicesByTier = (tier: number) => {
        const base = [
            { id: 'ai_plan', name: 'AI训练计划', desc: '个性化AI训练方案', icon: Brain, color: 'bg-blue-500', available: tier >= 1 }
        ]
        if (tier >= 3)
            base.push({ id: 'chat', name: '一对一聊天', desc: '与教练实时沟通交流', icon: MessageCircle, color: 'bg-purple-500', available: true })
        else
            base.push({ id: 'chat_demo', name: '🎯 体验聊天功能', desc: '免费体验一对一聊天 (演示版)', icon: MessageCircle, color: 'bg-primary-500', available: true })
        return base
    }

    const getSubscriptionStatus = (subscription: QueryCoachSubscription) => {
        if (!subscription.end_date) {
            return { status: 'active', text: '永久有效', color: 'success' }
        }

        const daysLeft = Math.ceil((new Date(subscription.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

        if (daysLeft <= 0) {
            return { status: 'expired', text: '已过期', color: 'danger' }
        }
        if (daysLeft <= 7) {
            return { status: 'expiring', text: `${daysLeft}天后过期`, color: 'warning' }
        }
        return { status: 'active', text: `${daysLeft}天后到期`, color: 'success' }
    }

    if (!subscriptions.length)
        return (
            <div className="text-center py-12">
                <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">还没有订阅任何教练</h3>
                <p className="text-gray-600 mb-6">选择专业教练，开始您的健身之旅</p>
                <Button label="浏览教练" className="bg-primary px-6 py-3 rounded-lg" onClick={() => router.push('/coach/discovery')} />
            </div>
        )

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {subscriptions.map(subscription => {
                    const status = getSubscriptionStatus(subscription);

                    const available = getServicesByTier(subscription.tier).filter(x => x.available)
                    return (
                        <Card key={subscription.id} className="overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-6 text-surface">
                                <div className="flex items-center space-x-4">
                                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                                        <span className="text-xl font-bold">{subscription.coach?.name.charAt(0)}</span>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold">{subscription.coach?.name}</h3>
                                        <p className="text-blue-100 text-sm">{subscription.coach?.title}</p>
                                        <div className="flex items-center space-x-1 mt-1">
                                            <Star className="w-4 h-4 text-yellow-300 fill-current" />
                                            <span className="text-sm">{subscription.coach?.rating}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center justify-between">
                                    <div>
                                        <div className="text-sm text-blue-100">订阅等级</div>
                                        <div className="text-lg font-bold">Tier {subscription.tier}</div>
                                    </div>
                                    <Tag value={status.text} severity={status.color as any} className="text-xs font-medium px-3 py-1" />
                                </div>
                            </div>
                            <div className="p-6">
                                <h4 className="text-sm font-semibold text-gray-700 mb-4">可用服务</h4>
                                <div className="space-y-3">
                                    {available.map(service => {
                                        const Icon = service.icon
                                        return (
                                            <Button
                                                key={service.id}
                                                onClick={() => onAccessService(service.id, subscription.coach_id)}
                                                className="w-full justify-start bg-gray-50 hover:bg-gray-100 text-left p-3 rounded-lg flex items-center space-x-3"
                                            >
                                                <div className={`w-10 h-10 ${service.color} rounded-lg flex items-center justify-center`}>
                                                    <Icon className="w-5 h-5 text-surface" />
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <div className="text-sm font-medium">{service.name}</div>
                                                    <div className="text-xs text-gray-500">{service.desc}</div>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-gray-400" />
                                            </Button>
                                        )
                                    })}
                                </div>
                                {status.status === 'expiring' && (
                                    <div className="mt-4 p-3 bg-primary-50 border border-primary-200 rounded-lg">
                                        <div className="flex items-center space-x-2">
                                            <Clock className="w-4 h-4 text-primary-600" />
                                            <span className="text-sm text-primary-800">订阅即将到期</span>
                                        </div>
                                        <Button label="立即续费" className="mt-2 w-full bg-primary-500 text-surface text-sm" />
                                    </div>
                                )}
                            </div>
                        </Card>
                    )
                })}
            </div>

            <Card className="p-6">
                <h3 className="text-lg font-semibold mb-6">训练统计</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <Stat icon={Brain} color="bg-blue-100 text-blue-600" value={stats.aiPlans} label="AI训练计划" />
                    <Stat icon={Video} color="bg-green-100 text-green-600" value={stats.videoReviews} label="视频点评" />
                    <Stat icon={MessageCircle} color="bg-purple-100 text-purple-600" value={stats.messages} label="聊天消息" />
                    <Stat icon={BarChart3} color="bg-primary-100 text-primary-600" value={stats.trainingDays} label="训练天数" />
                </div>
            </Card>

            <Card className="p-6">
                <h3 className="text-lg font-semibold mb-6">最近活动</h3>
                {activities.length === 0 ? (
                    <div className="text-center text-gray-500">暂无活动</div>
                ) : (
                    <div className="space-y-4">
                        {activities.map((a, i) => (
                            <div key={i} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                                    <Target className="w-5 h-5 text-surface" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-medium">{a.text}</div>
                                    <div className="text-xs text-gray-500">{new Date(a.time).toLocaleString()}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    )
}

const Stat = ({ icon: Icon, color, value, label }: any) => (
    <div className="text-center">
        <div className={`w-12 h-12 ${color} rounded-full flex items-center justify-center mx-auto mb-2`}>
            <Icon className="w-6 h-6" />
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-gray-600">{label}</div>
    </div>
)

export default SubscriptionDashboard
