'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Skeleton } from 'primereact/skeleton';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Target } from 'lucide-react';

import { subscriptionService } from '@/app/service/subscriptionService';
import { userService } from '@/app/service/userService';
import { useToastContext } from '@/context/ToastContext';

// 导入原有的 TodayTraining 组件
import TodayTraining from '../coach/plans/dashboard/[id]/TodayTraining';

const TodayTrainingPage: React.FC = () => {
    const { data: session } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();

    const [subscriptions, setSubscriptions] = useState<any[]>([]);
    const [trainingPlanId, setTrainingPlanId] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (session?.user?.id) {
            loadData();
        }
    }, [session?.user?.id]);

    const loadData = async () => {
        try {
            setLoading(true);

            // 获取用户的所有订阅
            const subsResponse = await subscriptionService.getCoachSubscriptions({
                studentId: session?.user?.id || '',
            });

            if (subsResponse?.subscriptions && subsResponse.subscriptions.length > 0) {
                setSubscriptions(subsResponse.subscriptions);
                
                // 获取第一个教练的训练计划
                const firstCoachId = subsResponse.subscriptions[0].coach_id;
                
                // 获取该教练的训练计划列表
                const plansResponse = await userService.getTrainingPlans({
                    coachId: firstCoachId,
                });

                if (plansResponse?.plans && plansResponse.plans.length > 0) {
                    // 使用第一个训练计划
                    setTrainingPlanId(plansResponse.plans[0].id);
                } else {
                    showToast({
                        severity: 'warn',
                        summary: '未找到训练计划',
                        detail: '该教练暂无训练计划，请联系教练创建计划',
                    });
                }
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
                <div className="space-y-4">
                    <Skeleton height="200px" />
                </div>
            </div>
        );
    }

    if (subscriptions.length === 0) {
        return (
            <div className="max-w-6xl mx-auto px-4 py-8">
                <Card className="shadow-sm">
                    <div className="text-center py-12">
                        <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                            还没有订阅任何教练
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            订阅教练后，这里将显示您的每日训练计划
                        </p>
                        <Button
                            label="浏览教练"
                            icon="pi pi-search"
                            className="p-button-primary"
                            onClick={() => router.push('/coach/discovery')}
                        />
                    </div>
                </Card>
            </div>
        );
    }

    if (!trainingPlanId) {
        return (
            <div className="max-w-6xl mx-auto px-4 py-8">
                <Card className="shadow-sm">
                    <div className="text-center py-12">
                        <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                            暂无训练计划
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            您的教练还没有为您创建训练计划，请联系教练
                        </p>
                        <Button
                            label="查看训练计划"
                            icon="pi pi-clipboard"
                            className="p-button-primary"
                            onClick={() => router.push('/coach/plans')}
                        />
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            {/* 使用原有的 TodayTraining 组件 */}
            <TodayTraining
                userId={session?.user?.id || ''}
                trainingPlanId={trainingPlanId}
            />
        </div>
    );
};

export default TodayTrainingPage;
