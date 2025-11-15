'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card } from 'primereact/card';
import { TabView, TabPanel } from 'primereact/tabview';
import { Button } from 'primereact/button';
import { Badge } from 'primereact/badge';
import { Skeleton } from 'primereact/skeleton';
import { userService } from '@/app/service/userService';
import { Play, TrendingUp, Calendar, Bell, Target, Clock, Award, BookOpen, ArrowLeft, Check } from 'lucide-react';

import TrainingExecution from './TrainingExecution';
import TrainingProgressDashboard from './TrainingProgressDashboard';
import TrainingReminder from './TrainingReminder';
import TrainingPlanPreview from './TrainingPlanPreview';
import { TrainingPlanRow } from '@/types';
import { useToastContext } from '@/context/ToastContext';


interface TrainingPlanDetail {
    id: string;
    training_plan_id: string;
    week_number: number;
    day_of_week: string;
    session_focus: string;
    main_exercises: any[];
    accessory_exercises: any[];
    order_index: number;
    notes: string;
}

const TrainingPlanDashboard: React.FC = () => {
    const router = useRouter();
    const { id: trainingPlanId } = useParams();
    const { data: session } = useSession();

    const { showToast } = useToastContext();

    // 状态管理
    const [activeTab, setActiveTab] = useState(0);
    const [trainingPlan, setTrainingPlan] = useState<TrainingPlanRow | null>(null);
    const [planPreview, setPlanPreview] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    // 加载训练计划数据
    useEffect(() => {
        if (trainingPlanId && session?.user?.id) {
            loadData();
        }
    }, [trainingPlanId, session?.user?.id]);


    const loadData = async () => {
        try {
            setLoading(true);

            // 获取训练计划详细内容用于预览
            const res = await userService.getTrainingPlanDetail({ id: trainingPlanId?.toString() || '' });

            if (res) {
                setTrainingPlan(res.plan);

                const weeksMap: Record<number, { week: number; sessions: any[] }> = {};
                for (const row of res.details ?? []) {
                    if (!weeksMap[row.week_number]) {
                        weeksMap[row.week_number] = { week: row.week_number, sessions: [] };
                    }
                    weeksMap[row.week_number].sessions.push({
                        day: row.day_of_week,
                        focus: row.session_focus,
                        main: row.main_exercises || [],
                        accessories: row.accessory_exercises || [],
                        notes: row.notes || ''
                    });
                }

                const weeks = Object.values(weeksMap).sort((a, b) => a.week - b.week);
                const frequencyPerWeek = weeks.length > 0 ? Math.max(...weeks.map(w => w.sessions.length)) : 0;

                setPlanPreview({
                    meta: {
                        title: res.plan.title || '',
                        duration_weeks: res.plan.duration_weeks || 6,
                        frequency_per_week: frequencyPerWeek || 3,
                        goal: res.plan.difficulty_level || '',
                        experience_level: res.plan.difficulty_level || '',
                        global_warmup: [],
                        cooldown: [],
                        safety_notes: []
                    },
                    weeks
                });
            }

        } catch (error) {

            showToast({
                severity: 'error',
                summary: '加载失败',
                detail: '无法加载训练计划数据，请稍后重试',
                life: 3000
            });
        } finally {
            setLoading(false);
        }
    };

    // 处理训练完成事件
    const handleSessionComplete = () => {
        // 重新加载数据以更新统计数据
        loadData();

        showToast({
            severity: 'success',
            summary: '训练完成',
            detail: '今日训练已完成，统计数据已更新',
            life: 3000
        });
    };

    // 如果未找到训练计划
    if (!loading && !trainingPlan) {
        return (
            <div className="max-w-6xl mx-auto p-4">
                <Card className="text-center py-8">
                    <div className="w-3rem h-3rem bg-gray-100 dark:bg-gray-800 border-circle flex align-items-center justify-content-center mx-auto mb-3">
                        <BookOpen className="w-2rem h-2rem text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">未找到训练计划</h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">请先生成一个训练计划</p>
                    <Button label="返回" icon="pi pi-arrow-left" onClick={() => router.back()} />
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-4">

            {/* 训练计划头部 */}
            {trainingPlan && (
                <div className="bg-gradient-to-r from-primary-500 to-purple-600 rounded-lg p-6 mb-6 text-white">
                    <div className="flex flex-column md:flex-row align-items-start justify-content-between">
                        <div className="flex-1 mb-4 md:mb-0">
                            <div className="flex align-items-center mb-4">
                                <Button
                                    icon="pi pi-arrow-left"
                                    className="p-button-rounded p-button-text text-white mr-3"
                                    onClick={() => router.back()}
                                />
                                <h1 className="text-2xl font-bold m-0">{trainingPlan.title}</h1>
                            </div>
                            <p className="text-blue-100 mb-3">{trainingPlan.description}</p>
                            <div className="flex flex-wrap align-items-center gap-3 text-sm">
                                <div className="flex align-items-center">
                                    <Clock className="w-4 h-4 mr-1" />
                                    <span>{trainingPlan.duration_weeks}周</span>
                                </div>
                                <div className="flex align-items-center">
                                    <Target className="w-4 h-4 mr-1" />
                                    <span className="capitalize">{trainingPlan.difficulty_level}</span>
                                </div>
                                {trainingPlan.ai_generated && (
                                    <div className="bg-blue-500 px-2 py-1 border-round text-xs flex align-items-center">
                                        <span className="mr-1">AI生成</span>
                                        <Badge value="AI" className="p-badge-success" />
                                    </div>
                                )}
                            </div>
                        </div>
                        <Award className="w-3rem h-3rem text-blue-200" />
                    </div>
                </div>
            )}

            {/* 标签页导航 */}
            <Card>
                <TabView activeIndex={activeTab} onTabChange={(e) => setActiveTab(e.index)}>
                    <TabPanel header="今日训练" leftIcon="pi pi-play mr-2">
                        {loading ? (
                            <div className="flex flex-column gap-3">
                                <Skeleton width="100%" height="150px" />
                                <Skeleton width="100%" height="50px" />
                                <Skeleton width="100%" height="200px" />
                            </div>
                        ) : (
                            <TrainingExecution
                                trainingPlanId={trainingPlanId as string}
                                userId={session?.user?.id || ''}
                                onSessionComplete={handleSessionComplete}
                            />
                        )}
                    </TabPanel>
                    <TabPanel header="训练进度" leftIcon="pi pi-chart-line mr-2">
                        {loading ? (
                            <div className="flex flex-column gap-3">
                                <Skeleton width="100%" height="200px" />
                                <Skeleton width="100%" height="150px" />
                                <Skeleton width="100%" height="100px" />
                            </div>
                        ) : (
                            <TrainingProgressDashboard
                                userId={session?.user?.id || ''}
                                trainingPlanId={trainingPlanId as string}
                            />
                        )}
                    </TabPanel>
                    <TabPanel header="训练计划" leftIcon="pi pi-calendar mr-2">
                        {loading ? (
                            <div className="flex flex-column gap-3">
                                <Skeleton width="100%" height="100px" />
                                <Skeleton width="100%" height="300px" />
                            </div>
                        ) : planPreview ? (
                            <TrainingPlanPreview
                                plan={planPreview}
                                showSaveButton={false}
                                onStart={() => setActiveTab(0)}
                            />
                        ) : (
                            <div className="text-center py-8">
                                <div className="w-3rem h-3rem bg-gray-100 dark:bg-gray-800 border-circle flex align-items-center justify-content-center mx-auto mb-3">
                                    <Target className="w-2rem h-2rem text-gray-400" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">暂无训练计划详情</h3>
                                <p className="text-gray-600 dark:text-gray-300">无法加载训练计划详情</p>
                            </div>
                        )}
                    </TabPanel>
                    <TabPanel header="训练提醒" leftIcon="pi pi-bell mr-2">
                        {loading ? (
                            <div className="flex flex-column gap-3">
                                <Skeleton width="100%" height="100px" />
                                <Skeleton width="100%" height="200px" />
                            </div>
                        ) : (
                            <TrainingReminder
                                userId={session?.user?.id || ''}
                                trainingPlanId={trainingPlanId as string}
                            />
                        )}
                    </TabPanel>
                </TabView>
            </Card>
        </div>
    );
};

export default TrainingPlanDashboard;