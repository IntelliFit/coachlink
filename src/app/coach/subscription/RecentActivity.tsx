import React, { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { Card } from 'primereact/card';
import { subscriptionService } from '@/app/service/subscriptionService';
import { useSession } from 'next-auth/react';

const RecentActivity: React.FC = () => {
    const { data: session } = useSession();
    const [activities, setActivities] = useState<Array<{ time: string; text: string }>>([]);

    useEffect(() => {
        const load = async () => {
            try {
                const [plans, msgs] = await Promise.all([
                    subscriptionService.getTrainingPlans(),
                    subscriptionService.coachMessages()
                ])

                const recent: Array<{ time: string; text: string }> = [];
                (plans?.plans || []).slice(0, 3).forEach((p: any) =>
                    recent.push({ time: p.created_at, text: `创建了新的训练计划《${p.title || '训练计划'}》` })
                );

                const msgsData = (msgs?.messages as any[]) || []
                msgsData.slice(0, 3).forEach((m: any) => recent.push({ time: m.created_at, text: '发送/收到了一条私信' }))
                recent.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
                setActivities(recent.slice(0, 5))
            } catch (error) {
                console.error("加载最近活动失败:", error);
                setActivities([])
            }
        }

        // 只有当用户会话存在时才加载数据
        if (session?.user?.id) {
            load()
        }
    }, [session?.user?.id])

    return (
        <Card className="shadow-sm">
            <h3 className="text-lg font-semibold mb-6">最近活动</h3>
            {activities.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400">暂无活动</div>
            ) : (
                <div className="space-y-4">
                    {activities.map((a, i) => (
                        <div key={i} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg dark:bg-gray-800">
                            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                                <Target className="w-5 h-5 text-surface" />
                            </div>
                            <div className="flex-1">
                                <div className="text-sm font-medium">{a.text}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(a.time).toLocaleString()}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    )
}

export default RecentActivity;