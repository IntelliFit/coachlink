import React, { useEffect, useState } from 'react';
import { Brain, Video, MessageCircle, BarChart3 } from 'lucide-react';
import { Card } from 'primereact/card';
import { subscriptionService } from '@/app/service/subscriptionService';
import { useSession } from 'next-auth/react';

const TrainingSummary: React.FC = () => {
    const { data: session } = useSession();
    const [stats, setStats] = useState({ aiPlans: 0, videoReviews: 0, messages: 0, trainingDays: 0 });

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
            } catch (error) {
                console.error("加载训练统计数据失败:", error);
                setStats({ aiPlans: 0, videoReviews: 0, messages: 0, trainingDays: 0 })
            }
        }

        // 只有当用户会话存在时才加载数据
        if (session?.user?.id) {
            load()
        }
    }, [session?.user?.id])

    const Stat = ({ icon: Icon, color, value, label }: any) => (
        <div className="text-center">
            <div className={`w-12 h-12 ${color} rounded-full flex items-center justify-center mx-auto mb-2`}>
                <Icon className="w-6 h-6" />
            </div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
        </div>
    );

    return (
        <Card className="shadow-sm">
            <h3 className="text-lg font-semibold mb-6">训练统计</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <Stat 
                    icon={Brain} 
                    color="bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300" 
                    value={stats.aiPlans} 
                    label="AI训练计划" 
                />
                <Stat 
                    icon={Video} 
                    color="bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300" 
                    value={stats.videoReviews} 
                    label="视频点评" 
                />
                <Stat 
                    icon={MessageCircle} 
                    color="bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300" 
                    value={stats.messages} 
                    label="聊天消息" 
                />
                <Stat 
                    icon={BarChart3} 
                    color="bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-300" 
                    value={stats.trainingDays} 
                    label="训练天数" 
                />
            </div>
        </Card>
    )
}

export default TrainingSummary;