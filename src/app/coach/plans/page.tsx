'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from 'primereact/button';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Skeleton } from 'primereact/skeleton';
import { userService } from '@/app/service/userService';
import { trainingService } from '@/app/service/trainingService';
import { TrainingPlanRow } from '@/types';
import { useToastContext } from '@/context/ToastContext';

import TrainingPlanPreview from './dashboard/[id]/TrainingPlanPreview';

const TrainingPlansHome: React.FC = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session } = useSession();
    const { showToast } = useToastContext();

    const coachId = searchParams.get('coachId');

    const [plans, setPlans] = useState<TrainingPlanRow[]>([]);
    const [planPreviews, setPlanPreviews] = useState<Map<string, any>>(new Map());
    const [loading, setLoading] = useState(true);
    const [loadingPreviews, setLoadingPreviews] = useState<Set<string>>(new Set());
    const [deletingPlans, setDeletingPlans] = useState<Set<string>>(new Set());

    // 加载训练计划列表
    useEffect(() => {
        if (!session?.user?.id) return;

        const load = async () => {
            try {
                setLoading(true);
                const res = await userService.getTrainingPlans({
                    coachId: coachId || '',
                });

                if (res) {
                    setPlans(res.plans);
                    // 自动加载所有计划的预览
                    res.plans.forEach(plan => {
                        loadPlanPreview(plan.id);
                    });
                }
            } catch (e) {
                setPlans([]);
                showToast({
                    severity: 'error',
                    summary: '加载失败',
                    detail: '无法加载训练计划列表，请稍后重试',
                });
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [session?.user?.id, coachId]);

    // 加载单个计划的预览
    const loadPlanPreview = async (planId: string) => {
        try {
            setLoadingPreviews(prev => new Set(prev).add(planId));
            
            const preview = await trainingService.getPlanPreview({ 
                training_plan_id: planId 
            });

            if (preview) {
                setPlanPreviews(prev => new Map(prev).set(planId, preview));
            }
        } catch (error) {
            console.error(`加载计划 ${planId} 预览失败:`, error);
        } finally {
            setLoadingPreviews(prev => {
                const newSet = new Set(prev);
                newSet.delete(planId);
                return newSet;
            });
        }
    };

    // 删除计划
    const handleDeletePlan = async (planId: string, planTitle: string) => {
        const confirm = () =>
            new Promise<boolean>((resolve) => {
                confirmDialog({
                    message: `确定删除训练计划"${planTitle}"吗？该操作不可恢复。`,
                    header: '删除确认',
                    icon: 'pi pi-exclamation-triangle',
                    acceptLabel: '确认删除',
                    rejectLabel: '取消',
                    accept: () => resolve(true),
                    reject: () => resolve(false),
                });
            });

        if (await confirm()) {
            setDeletingPlans(prev => new Set(prev).add(planId));
            
            try {
                const res = await userService.deleteTrainingPlan(planId);

                if (!res) {
                    showToast({
                        severity: 'error',
                        summary: '删除失败',
                        detail: '删除训练计划失败，请稍后重试',
                    });
                } else {
                    setPlans((prev) => prev.filter((p) => p.id !== planId));
                    setPlanPreviews(prev => {
                        const newMap = new Map(prev);
                        newMap.delete(planId);
                        return newMap;
                    });

                    showToast({
                        severity: 'success',
                        summary: '删除成功',
                        detail: '训练计划已成功删除',
                    });
                }
            } finally {
                setDeletingPlans(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(planId);
                    return newSet;
                });
            }
        }
    };

    // 骨架屏
    const SkeletonCard = () => (
        <div className="p-card shadow-sm mb-6">
            <div className="flex flex-col gap-3">
                <Skeleton height="22px" width="60%" />
                <Skeleton height="18px" width="80%" />
                <Skeleton height="18px" width="40%" />
                <Skeleton height="300px" width="100%" className="mt-4" />
                <div className="flex gap-2 mt-3">
                    <Skeleton height="36px" width="100px" />
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen">
            <ConfirmDialog />

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* 顶部标题 */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            AI智能训练计划
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                            基于规则引擎 + AI 增强的个性化方案
                        </p>
                    </div>

                    <Button
                        label="生成新计划"
                        icon="pi pi-plus"
                        className="p-button-primary"
                        onClick={() => router.push(`/generate-plan?coachId=${coachId || ''}`)}
                    />
                </div>

                <div className="flex justify-end mb-4">
                    <Button
                        label="清理无教练计划"
                        className="p-button-text p-button-secondary"
                        icon="pi pi-trash"
                        onClick={async () => {
                            const res = await userService.cleanupOrphanPlans();
                            if (res) {
                                showToast({
                                    severity: 'success',
                                    summary: '已清理',
                                    detail: `删除 ${res.deleted} 个无教练计划`,
                                });
                            } else {
                                showToast({
                                    severity: 'warn',
                                    summary: '无可清理项',
                                    detail: '或清理失败，请稍后重试',
                                });
                            }
                        }}
                    />
                </div>

                {/* 内容 */}
                {loading ? (
                    <div className="space-y-6">
                        {Array.from({ length: 2 }).map((_, i) => (
                            <SkeletonCard key={i} />
                        ))}
                    </div>
                ) : plans.length === 0 ? (
                    <div className="p-card shadow-sm text-center py-12">
                        <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mx-auto mb-3">
                            <i className="pi pi-clipboard text-2xl text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            还没有训练计划
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            点击下方按钮创建你的第一份个性化训练计划
                        </p>
                        <Button
                            label="生成新计划"
                            className="p-button-primary"
                            onClick={() => router.push('/training')}
                        />
                    </div>
                ) : (
                    <div className="space-y-6">
                        {plans.map((plan) => {
                            const preview = planPreviews.get(plan.id);
                            const isLoadingPreview = loadingPreviews.has(plan.id);

                            return (
                                <div key={plan.id} className="p-card shadow-sm">
                                    {/* 计划头部 */}
                                    <div className="bg-gradient-to-r from-primary-500 to-red-500 rounded-t-lg p-6 text-white -m-6 mb-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <h2 className="text-2xl font-bold mb-2">{plan.title}</h2>
                                                <p className="opacity-90 mb-3">{plan.description}</p>
                                                <div className="flex items-center space-x-4 text-sm">
                                                    <span className="bg-white/20 px-3 py-1 rounded-full">
                                                        {plan.duration_weeks}周
                                                    </span>
                                                    <span className="bg-white/20 px-3 py-1 rounded-full capitalize">
                                                        {plan.difficulty_level}
                                                    </span>
                                                    {plan.ai_generated && (
                                                        <span className="bg-purple-500/50 px-3 py-1 rounded-full">
                                                            AI生成
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <Button
                                                label="删除"
                                                icon="pi pi-trash"
                                                loading={deletingPlans.has(plan.id)}
                                                severity="danger"
                                                className="bg-white/10 hover:bg-white/20 border-white/30"
                                                onClick={() => handleDeletePlan(plan.id, plan.title)}
                                            />
                                        </div>
                                    </div>

                                    {/* 计划内容 */}
                                    {isLoadingPreview ? (
                                        <div className="space-y-3">
                                            <Skeleton height="100px" />
                                            <Skeleton height="300px" />
                                        </div>
                                    ) : preview ? (
                                        <TrainingPlanPreview
                                            plan={preview}
                                            showSaveButton={false}
                                        />
                                    ) : (
                                        <div className="text-center py-8 text-gray-500">
                                            无法加载训练计划详情
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrainingPlansHome;