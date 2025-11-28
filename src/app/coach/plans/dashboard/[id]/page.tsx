'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { trainingService } from '@/app/service/trainingService';
import { Target, Clock, Award, BookOpen } from 'lucide-react';

import TrainingPlanPreview from './TrainingPlanPreview';
import { TrainingPlanRow } from '@/types';
import { useToastContext } from '@/context/ToastContext';


const TrainingPlanDashboard: React.FC = () => {
    const router = useRouter();
    const { id: trainingPlanId } = useParams();
    const { data: session } = useSession();
    const { showToast } = useToastContext();

    // 状态管理
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

            // 使用 trainingService 获取训练中心数据和计划预览
            const [hubData, preview] = await Promise.all([
                trainingService.getHubData({ training_plan_id: trainingPlanId?.toString() || '' }),
                trainingService.getPlanPreview({ training_plan_id: trainingPlanId?.toString() || '' })
            ]);

            if (hubData?.training_plan) {
                setTrainingPlan(hubData.training_plan as any);
            }

            if (preview) {
                setPlanPreview(preview);
            }

        } catch (error) {
            console.error('加载训练计划数据失败:', error);
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

    // 如果未找到训练计划
    if (!loading && !trainingPlan) {
        return (
            <div className="max-w-6xl mx-auto p-4">
                <Card className="text-center py-8">
                    <div className="w-3rem h-3rem bg-surface border-circle flex align-items-center justify-content-center mx-auto mb-3">
                        <BookOpen className="w-2rem h-2rem text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-900 mb-2">未找到训练计划</h3>
                    <p className="text-600 mb-4">请先生成一个训练计划</p>
                    <Button label="返回" icon="pi pi-arrow-left" onClick={() => router.back()} />
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-4">

            {/* 训练计划头部 */}
            <div className="mb-6">

                {/* 加载中 —— 使用 Skeleton 骨架屏 */}
                {loading && (
                    <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl p-6 shadow-md animate-pulse">
                        <div className="flex flex-column md:flex-row justify-content-between gap-4">
                            <div className="flex-1">
                                {/* 返回按钮 + 标题骨架 */}
                                <div className="flex align-items-center mb-4">
                                    <div className="w-3rem h-3rem bg-gray-300 dark:bg-gray-700 rounded-full mr-3"></div>
                                    <div className="h-2rem w-10rem bg-gray-300 dark:bg-gray-700 rounded"></div>
                                </div>

                                {/* 描述骨架 */}
                                <div className="h-1rem w-3/4 bg-gray-300 dark:bg-gray-700 rounded mb-3"></div>
                                <div className="h-1rem w-2/4 bg-gray-300 dark:bg-gray-700 rounded mb-4"></div>

                                {/* 信息标签骨架 */}
                                <div className="flex gap-3">
                                    <div className="h-2rem w-6rem bg-gray-300 dark:bg-gray-700 rounded-full"></div>
                                    <div className="h-2rem w-6rem bg-gray-300 dark:bg-gray-700 rounded-full"></div>
                                </div>
                            </div>

                            {/* 右侧图标骨架 */}
                            <div className="flex justify-content-center md:justify-content-end">
                                <div className="w-12 h-12 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 数据加载完成后显示实际 UI */}
                {!loading && trainingPlan && (
                    <div className="bg-gradient-to-r from-primary-500 to-red-500 rounded-2xl p-6 text-white shadow-lg">
                        <div className="flex flex-column md:flex-row justify-content-between gap-4">

                            {/* 左侧信息 */}
                            <div className="flex-1">
                                <div className="flex align-items-center mb-4">
                                    <Button
                                        icon="pi pi-arrow-left"
                                        className="p-button-rounded p-button-text text-white mr-3 hover:bg-white/20 transition-colors"
                                        onClick={() => {
                                            // 返回到教练计划列表页面，携带该计划的 coach_id
                                            if (trainingPlan?.coach_id) {
                                                router.push(`/coach/plans?coachId=${trainingPlan.coach_id}`);
                                            } else {
                                                router.push('/coach/plans');
                                            }
                                        }}
                                    />
                                    <h1 className="text-2xl font-bold tracking-wide m-0">
                                        {trainingPlan.title}
                                    </h1>
                                </div>

                                <p className="opacity-90 mb-4 leading-relaxed">
                                    {trainingPlan.description}
                                </p>

                                <div className="flex flex-wrap align-items-center gap-3 text-sm opacity-95">
                                    <div className="flex align-items-center bg-white/10 px-3 py-1 rounded-full">
                                        <Clock className="w-4 h-4 mr-2" />
                                        <span>{trainingPlan.duration_weeks}周</span>
                                    </div>

                                    <div className="flex align-items-center bg-white/10 px-3 py-1 rounded-full capitalize">
                                        <Target className="w-4 h-4 mr-2" />
                                        <span>{trainingPlan.difficulty_level}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-content-center md:justify-content-end">
                                <Award className="w-12 h-12 opacity-80 drop-shadow-md" />
                            </div>

                        </div>
                    </div>
                )}

            </div>


            {/* 训练计划内容 - 直接显示，无标签页 */}
            <div>
                {loading ? (
                    <div className="flex flex-column gap-3">
                        <Skeleton width="100%" height="100px" />
                        <Skeleton width="100%" height="300px" />
                    </div>
                ) : planPreview ? (
                    <TrainingPlanPreview
                        plan={planPreview}
                        showSaveButton={false}
                    />
                ) : (
                    <div className="text-center py-8">
                        <div className="w-3rem h-3rem bg-surface border-circle flex align-items-center justify-content-center mx-auto mb-3">
                            <Target className="w-2rem h-2rem text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-900 mb-2">暂无训练计划详情</h3>
                        <p className="text-600">无法加载训练计划详情</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrainingPlanDashboard;