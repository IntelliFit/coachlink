'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Skeleton } from 'primereact/skeleton';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Target } from 'lucide-react';

import { subscriptionService } from '@/app/service/subscriptionService';
import { planLibService } from '@/app/service/planLibService';
import { useToastContext } from '@/context/ToastContext';

import TodayTrainingCard from './TodayTrainingCard';
import RestDayCard from './RestDayCard';
import BrowseSection from './BrowseSection';

const TodayTrainingPage: React.FC = () => {
    const { data: session } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();

    const [instance, setInstance] = useState<any>(null);
    const [actions, setActions] = useState<Record<string, any>>({});
    const [todayDayIndex, setTodayDayIndex] = useState(1);
    const [loading, setLoading] = useState(true);
    const [subscription, setSubscription] = useState<any>(null);
    const [executionStatus, setExecutionStatus] = useState<'none' | 'in_progress' | 'completed'>('none');
    const [completedSets, setCompletedSets] = useState(0);
    const [totalSets, setTotalSets] = useState(0);

    useEffect(() => {
        if (session?.user?.id) {
            loadData();
        }
    }, [session?.user?.id]);

    const loadData = async () => {
        try {
            setLoading(true);

            // 1. 获取订阅
            const subsResponse = await subscriptionService.getCoachSubscriptions({
                studentId: session?.user?.id || '',
            });

            if (!subsResponse?.subscriptions || subsResponse.subscriptions.length === 0) {
                setLoading(false);
                return;
            }

            const activeSub = subsResponse.subscriptions[0];
            setSubscription(activeSub);

            // 2. 获取计划实例（包含actions）
            const res = await planLibService.getInstance({
                subscriptionId: activeSub.id
            });

            if (!res?.instance) {
                showToast({
                    severity: 'warn',
                    summary: '未找到训练计划',
                    detail: '该教练暂未为您分配训练计划',
                });
                setLoading(false);
                return;
            }

            setInstance(res.instance);
            setActions(res.actions || {});

            // 3. 计算今天是第几天
            const planStartDate = new Date(res.instance.created_at);
            const today = new Date();
            const daysDiff = Math.floor(
                (today.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            
            // Day index循环：1-7
            const calculatedDayIndex = ((daysDiff % 7) + 1);
            setTodayDayIndex(calculatedDayIndex);

            // 4. 检查今天的执行状态
            try {
                const execRes = await fetch(`/api/execution/check-today?instanceId=${res.instance.id}&dayIndex=${calculatedDayIndex}`);
                const execData = await execRes.json();
                if (execData.success && execData.data) {
                    setExecutionStatus(execData.data.status);
                    setCompletedSets(execData.data.completed_sets || 0);
                    setTotalSets(execData.data.total_sets || 0);
                }
            } catch (e) {
                console.log('No execution found for today');
            }

        } catch (error) {
            console.error('加载数据失败:', error);
            showToast({
                severity: 'error',
                summary: '加载失败',
                detail: '无法加载训练数据，请稍后重试',
            });
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto px-4 py-8">
                <Skeleton height="100px" className="mb-6" />
                <Skeleton height="400px" />
            </div>
        );
    }

    if (!subscription) {
        return (
            <div className="max-w-6xl mx-auto px-4 py-8">
                <Card>
                    <div className="text-center py-12">
                        <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">还没有订阅任何教练</h3>
                        <p className="text-gray-600 mb-6">
                            订阅教练后，这里将显示您的每日训练计划
                        </p>
                        <Button
                            label="浏览教练"
                            icon="pi pi-search"
                            onClick={() => router.push('/coach/discovery')}
                        />
                    </div>
                </Card>
            </div>
        );
    }

    if (!instance) {
        return (
            <div className="max-w-6xl mx-auto px-4 py-8">
                <Card>
                    <div className="text-center py-12">
                        <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">暂无训练计划</h3>
                        <p className="text-gray-600 mb-6">
                            您的教练还没有为您分配训练计划
                        </p>
                        <Button
                            label="查看训练计划"
                            icon="pi pi-clipboard"
                            onClick={() => router.push('/coach/plans')}
                        />
                    </div>
                </Card>
            </div>
        );
    }

    // 找到今天的训练日
    const trainingDays = (instance.training_days || []) as any[];
    const todayTraining = trainingDays.find(d => d.day_index === todayDayIndex);

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            {/* 教练信息卡片 */}
            {subscription?.coach && (
                <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg p-4 mb-6 text-white shadow-lg">
                    <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                            <span className="text-lg font-bold">
                                {subscription.coach.name?.charAt(0) || '教'}
                            </span>
                        </div>
                        <div>
                            <div className="text-sm opacity-90">当前教练</div>
                            <div className="text-lg font-bold">
                                {subscription.coach.name || '未知教练'}
                            </div>
                            {subscription.coach.title && (
                                <div className="text-xs opacity-80">
                                    {subscription.coach.title}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 今日训练 */}
            {todayTraining && todayTraining.type === 'training' ? (
                <TodayTrainingCard
                    day={todayTraining}
                    actions={actions}
                    instanceId={instance.id}
                    dayIndex={todayDayIndex}
                    executionStatus={executionStatus}
                    completedSets={completedSets}
                    totalSets={totalSets}
                />
            ) : (
                <RestDayCard dayIndex={todayDayIndex} />
            )}

            {/* 浏览其他训练日 */}
            <BrowseSection
                instance={instance}
                actions={actions}
                currentDayIndex={todayDayIndex}
                todayExecutionStatus={executionStatus}
            />
        </div>
    );
};

export default TodayTrainingPage;
