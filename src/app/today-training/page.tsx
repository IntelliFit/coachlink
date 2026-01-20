'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Skeleton } from 'primereact/skeleton';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Target } from 'lucide-react';

import { subscriptionService } from '@/app/service/subscriptionService';
import { planLibService } from '@/app/service/planLibService';
import { executionService } from '@/app/service/executionService';
import { useToastContext } from '@/context/ToastContext';

import TodayTrainingCard from './TodayTrainingCard';
import RestDayCard from './RestDayCard';
import BrowseSection from './BrowseSection';

import PlanCompletionModal from '@/components/plan/PlanCompletionModal';
import { Avatar } from 'primereact/avatar';

// 骨架屏组件
import CoachCardSkeleton from './skeletons/CoachCardSkeleton';
import SelfPlanCardSkeleton from './skeletons/SelfPlanCardSkeleton';
import TodayTrainingCardSkeleton from './skeletons/TodayTrainingCardSkeleton';
import BrowseSectionSkeleton from './skeletons/BrowseSectionSkeleton';

const TodayTrainingPage: React.FC = () => {
    const { data: session } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();

    // 教练分配的计划
    const [coachInstance, setCoachInstance] = useState<any>(null);
    const [coachActions, setCoachActions] = useState<Record<string, any>>({});
    const [coachDayIndex, setCoachDayIndex] = useState(1);
    const [coachTodayCompleted, setCoachTodayCompleted] = useState(false);
    const [coachCompletionDates, setCoachCompletionDates] = useState<Record<number, string>>({});

    // 自建计划
    const [selfInstance, setSelfInstance] = useState<any>(null);
    const [selfActions, setSelfActions] = useState<Record<string, any>>({});
    const [selfDayIndex, setSelfDayIndex] = useState(1);
    const [selfTodayCompleted, setSelfTodayCompleted] = useState(false);
    const [selfCompletionDates, setSelfCompletionDates] = useState<Record<number, string>>({});

    // 当前显示模式: 'coach' | 'self'
    const [planMode, setPlanMode] = useState<'coach' | 'self'>('coach');

    // 分部分加载状态
    const [loadingSubscription, setLoadingSubscription] = useState(true);
    const [loadingCoachPlan, setLoadingCoachPlan] = useState(true);
    const [loadingSelfPlan, setLoadingSelfPlan] = useState(true);
    const [subscription, setSubscription] = useState<any>(null);
    const [executionStatus, setExecutionStatus] = useState<'none' | 'in_progress' | 'completed'>('none');
    const [completedSets, setCompletedSets] = useState(0);
    const [totalSets, setTotalSets] = useState(0);

    // 计划完成弹窗状态
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [completedPlanInfo, setCompletedPlanInfo] = useState<{ name: string, rate: number } | null>(null);

    // 当前激活的计划（根据 planMode 动态选择）
    const instance = planMode === 'coach' ? coachInstance : selfInstance;
    const actions = planMode === 'coach' ? coachActions : selfActions;
    const todayDayIndex = planMode === 'coach' ? coachDayIndex : selfDayIndex;
    const todayCompleted = planMode === 'coach' ? coachTodayCompleted : selfTodayCompleted;
    const completionDates = planMode === 'coach' ? coachCompletionDates : selfCompletionDates;

    useEffect(() => {
        if (!session?.user?.id) return;

        // 并行加载所有数据
        const loadAllData = async () => {
            try {
                // 1. 先加载订阅信息（其他数据依赖此信息）
                setLoadingSubscription(true);
                const activeSubs = await loadSubscriptions();
                // 立即设置订阅信息，这样 loadingSubscription 完成后 subscription 就已经有了
                if (activeSubs.length > 0) {
                    setSubscription(activeSubs[0]);
                }
                setLoadingSubscription(false);

                // 2. 一次性加载教练计划和自建计划
                setLoadingCoachPlan(true);
                setLoadingSelfPlan(true);
                const plansData = await loadPlans(activeSubs);

                // 3. 处理加载结果
                const coachResult = plansData.coachPlan
                    ? {
                        planData: plansData.coachPlan,
                        subscription: activeSubs.find((s: any) => s.id === plansData.coachPlan?.matchedSubscriptionId) || activeSubs[0] || null,
                        allSubs: plansData.allSubs,
                    }
                    : null;
                const selfResult = plansData.selfPlan;

                // 4. 并行处理计划数据（可以独立处理）
                await Promise.all([
                    processCoachPlan(coachResult, activeSubs).finally(() => setLoadingCoachPlan(false)),
                    processSelfPlan(selfResult).finally(() => setLoadingSelfPlan(false)),
                ]);

                // 5. 设置默认显示模式（依赖两个计划的结果）
                setDefaultPlanMode(coachResult, selfResult);

            } catch (error) {
                console.error('加载数据失败:', error);
                showToast({
                    severity: 'error',
                    summary: '加载失败',
                    detail: '无法加载训练数据，请稍后重试',
                });
                setLoadingSubscription(false);
                setLoadingCoachPlan(false);
                setLoadingSelfPlan(false);
            }
        };

        loadAllData();
    }, [session?.user?.id]);

    // 1. 加载订阅信息
    const loadSubscriptions = async () => {
        const subsResponse = await subscriptionService.getCoachSubscriptions({
            studentId: session?.user?.id || '',
            computePauseAwareEndDate: false,
        });

        const activeSubs = (subsResponse?.subscriptions || []).filter((s: any) => !!s?.id);
        return activeSubs;
    };

    // 2. 加载教练计划和自建计划（合并为一次请求）
    const loadPlans = async (activeSubs: any[]) => {
        try {
            const subscriptionIds = activeSubs.map((s: any) => s.id).filter(Boolean);
            const result = await planLibService.getTodayTrainingInstance({
                subscriptionIds: subscriptionIds.length > 0 ? subscriptionIds : undefined,
            });

            return {
                coachPlan: result.coachPlan,
                selfPlan: result.selfPlan,
                allSubs: activeSubs,
            };
        } catch (error) {
            console.error('[today-training] 加载计划失败:', error);
            return {
                coachPlan: null,
                selfPlan: null,
                allSubs: activeSubs,
            };
        }
    };

    // 4. 处理教练计划数据
    const processCoachPlan = async (coachResult: any, activeSubs: any[]) => {
        if (!coachResult) {
            // 设置订阅信息（即使没有计划）
            if (activeSubs.length > 0) {
                setSubscription(activeSubs[0]);
            }
            return;
        }

        const { planData: coachRes, subscription: coachSub, allSubs } = coachResult;

        // 设置订阅信息：优先使用"有计划的订阅"，否则回退到第一个活跃订阅
        setSubscription(coachSub || allSubs[0] || null);

        if (!coachRes?.instance) {
            return;
        }

        setCoachInstance(coachRes.instance);
        setCoachActions(coachRes.actions || {});

        const derived = coachRes as any;
        if (typeof derived.nextDayIndex === 'number') {
            setCoachDayIndex(derived.nextDayIndex);
            setCoachTodayCompleted(derived.todayCompleted || false);
            setCoachCompletionDates(derived.completionDates || {});

            const completedCount = (derived.completedDays || []).length;
            const totalCount = derived.totalTrainingDays || 0;
            if (totalCount > 0 && completedCount >= totalCount && coachRes.instance.status === 'active') {
                await handleCompletePlan(coachRes.instance);
            }
        } else {
            // fallback: legacy API
            try {
                const nextDayData = await executionService.getNextTrainingDay({
                    instanceId: coachRes.instance.id
                });
                if (nextDayData) {
                    setCoachDayIndex(nextDayData.nextDayIndex);
                    setCoachTodayCompleted(nextDayData.todayCompleted || false);
                    setCoachCompletionDates(nextDayData.completionDates || {});

                    const completedCount = nextDayData.completedDays.length;
                    const totalCount = nextDayData.totalTrainingDays;

                    if (totalCount > 0 && completedCount >= totalCount && coachRes.instance.status === 'active') {
                        await handleCompletePlan(coachRes.instance);
                    }
                }
            } catch (e) {
                const startDay = (coachRes.instance as any).start_execution_day || 1;
                setCoachDayIndex(startDay);
            }
        }
    };

    // 5. 处理自建计划数据
    const processSelfPlan = async (selfRes: any) => {
        if (!selfRes?.instance) {
            return;
        }

        setSelfInstance(selfRes.instance);
        setSelfActions(selfRes.actions || {});

        const derived = selfRes as any;
        if (typeof derived.nextDayIndex === 'number') {
            setSelfDayIndex(derived.nextDayIndex);
            setSelfTodayCompleted(derived.todayCompleted || false);
            setSelfCompletionDates(derived.completionDates || {});

            const completedCount = (derived.completedDays || []).length;
            const totalCount = derived.totalTrainingDays || 0;
            if (totalCount > 0 && completedCount >= totalCount && selfRes.instance.status === 'active') {
                await handleCompletePlan(selfRes.instance);
            }
        } else {
            // fallback: legacy API
            try {
                const nextDayData = await executionService.getNextTrainingDay({
                    instanceId: selfRes.instance.id
                });
                if (nextDayData) {
                    setSelfDayIndex(nextDayData.nextDayIndex);
                    setSelfTodayCompleted(nextDayData.todayCompleted || false);
                    setSelfCompletionDates(nextDayData.completionDates || {});

                    const completedCount = nextDayData.completedDays.length;
                    const totalCount = nextDayData.totalTrainingDays;

                    if (totalCount > 0 && completedCount >= totalCount && selfRes.instance.status === 'active') {
                        await handleCompletePlan(selfRes.instance);
                    }
                }
            } catch (e) {
                const startDay = (selfRes.instance as any).start_execution_day || 1;
                setSelfDayIndex(startDay);
            }
        }
    };

    // 6. 设置默认显示模式
    const setDefaultPlanMode = (coachResult: any, selfResult: any) => {
        const coachRes = coachResult?.planData;
        if (coachRes?.instance) {
            setPlanMode('coach');
        } else if (selfResult?.instance) {
            setPlanMode('self');
        }
    };

    // 处理计划完成
    const handleCompletePlan = async (targetInstance: any) => {
        try {
            const res = await fetch('/api/plan-lib/complete-instance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instanceId: targetInstance.id })
            });

            if (res.ok) {
                setCompletedPlanInfo({
                    name: targetInstance.name,
                    rate: 100
                });
                setShowCompletionModal(true);
            }
        } catch (error) {
            console.error('完成计划失败', error);
        }
    };

    // 移除自建计划
    const handleRemoveSelfPlan = async () => {
        if (!selfInstance) return;

        try {
            await planLibService.deleteInstance({ id: selfInstance.id });
            setSelfInstance(null);

            // 如果有教练计划，切换到教练计划
            if (coachInstance) {
                setPlanMode('coach');
            }

            showToast({
                severity: 'success',
                summary: '已移除',
                detail: '计划已从今日训练中移除',
            });
        } catch (error) {
            console.error('移除计划失败:', error);
            showToast({
                severity: 'error',
                summary: '移除失败',
                detail: '无法移除计划，请稍后重试',
            });
        }
    };

    // 确认移除对话框
    const confirmRemovePlan = () => {
        confirmDialog({
            message: '确定要移除这个计划吗？移除后将不会在今日训练中显示，但训练记录会保留。',
            header: '确认移除计划',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            acceptLabel: '确认移除',
            rejectLabel: '取消',
            accept: handleRemoveSelfPlan,
        });
    };

    // 跳转到问卷更新页面（教练主页）
    const handleUpdateProfile = () => {
        // 导航到教练主页，并触发问卷填写对话框
        if (subscription?.coach_id) {
            router.push(`/coach/profile/${subscription.coach_id}?action=questionnaire`);
        } else {
            // 没有教练订阅，回退到个人档案
            router.push('/me/profile');
        }
    };

    const handleGenerateNextPlan = () => {
        // 跳转到智能生成页面或计划库页面
        if (subscription?.id) {
            router.push(`/me/plan-lib?subscriptionId=${subscription.id}`);
        } else {
            router.push('/me/plan-lib');
        }
    };

    const handleViewHistory = () => {
        router.push('/me/plan-history');
    };
    // 判断是否有任何计划
    const hasAnyPlan = coachInstance || selfInstance;
    const hasBothPlans = coachInstance && selfInstance;
    const isInitialLoading = loadingSubscription || (loadingCoachPlan && loadingSelfPlan);

    if (!isInitialLoading && !hasAnyPlan) {
        const subscribedCoachName =
            subscription?.coach?.name ||
            subscription?.coach?.title ||
            subscription?.coach_id ||
            '';
        const hasActiveSubscription = !!subscription?.id;

        // 有订阅但暂无计划：展示“教练制定中”的等待页
        if (hasActiveSubscription) {
            return (
                <div className="max-w-6xl mx-auto px-6 py-12 animate-in fade-in duration-700">
                    <Card className="rounded-3xl bg-transparent shadow-none overflow-hidden">
                        <div className="text-center py-16 px-4">
                            <div className="relative inline-block mb-6">
                                <div className="absolute inset-0 animate-ping opacity-20 bg-primary-400 rounded-full" />
                                <div className="relative bg-surface-50 p-6 rounded-full border border-surface-100">
                                    <Target className="w-10 h-10 text-primary-500 stroke-[1.5]" />
                                </div>
                            </div>

                            <h3 className="text-2xl font-bold tracking-tight text-surface-900 mb-3">
                                计划正在制定中
                            </h3>
                            <p className="text-surface-500 max-w-sm mx-auto mb-10 leading-relaxed text-balance">
                                {subscribedCoachName
                                    ? `您的教练「${subscribedCoachName}」正在为您制定训练计划，请耐心等待。`
                                    : '您的教练正在为您制定训练计划，请耐心等待。'}
                            </p>

                            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                                <Button
                                    label="联系教练"
                                    icon="pi pi-comments"
                                    onClick={() => {
                                        // messages page supports deep link via coachId (coaches.id)
                                        if (subscription?.coach_id) {
                                            router.push(`/messages?coachId=${subscription.coach_id}`);
                                        } else {
                                            router.push('/messages');
                                        }
                                    }}
                                    className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-primary-500 border-none transition-all active:scale-95 duration-200 ease-out"
                                />
                                <Button
                                    label="我的计划库"
                                    icon="pi pi-bookmark"
                                    onClick={() => router.push('/me/plan-lib')}
                                    className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-surface-50 text-surface-700 border border-surface-200 transition-all active:scale-95 duration-200 ease-out hover:bg-surface-100 shadow-none"
                                />
                            </div>
                        </div>
                    </Card>
                </div>
            );
        }

        return (
            <div className="max-w-6xl mx-auto px-6 py-12 animate-in fade-in duration-700">
                {/* 1. 容器与深度：使用 surface 背景与极浅边框，摒弃阴影 */}
                <Card className="rounded-3xl bg-transparent shadow-none overflow-hidden">
                    <div className="text-center py-16 px-4">

                        {/* 2. 状态动效：利用微弱的周期性动效引导注意力 */}
                        <div className="relative inline-block mb-6">
                            <div className="absolute inset-0 animate-ping opacity-20 bg-primary-400 rounded-full" />
                            <div className="relative bg-surface-50 p-6 rounded-full border border-surface-100">
                                <Target className="w-10 h-10 text-surface-400 stroke-[1.5]" />
                            </div>
                        </div>

                        {/* 3. 内容排版：紧凑字间距与色彩层次 */}
                        <h3 className="text-2xl font-bold tracking-tight text-surface-900 mb-3">
                            开启您的训练旅程
                        </h3>
                        <p className="text-surface-500 max-w-sm mx-auto mb-10 leading-relaxed text-balance">
                            您可以订阅教练获取专业计划，或者在您的私人库中创建专属训练
                        </p>

                        {/* 4. 状态反馈：物理缩放与强调色联动 */}
                        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                            <Button
                                label="浏览教练"
                                icon="pi pi-compass"
                                onClick={() => router.push('/coach/discovery')}
                                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-primary-500 border-none transition-all active:scale-95 duration-200 ease-out"
                            />
                            <Button
                                label="我的计划库"
                                icon="pi pi-bookmark"
                                onClick={() => router.push('/me/plan-lib')}
                                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-surface-50 text-surface-700 border border-surface-200 transition-all active:scale-95 duration-200 ease-out hover:bg-surface-100 shadow-none"
                            />
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    // 找到今天的训练日
    const trainingDays = (instance?.training_days || []) as any[];
    const todayTraining = trainingDays.find(d => d.dayIndex === todayDayIndex);

    return (
        <div className="min-h-screen bg-surface pb-12">
            {/* 确认对话框 */}
            <ConfirmDialog />

            {/* 计划完成弹窗 */}
            {completedPlanInfo && (
                <PlanCompletionModal
                    visible={showCompletionModal}
                    onHide={() => setShowCompletionModal(false)}
                    planName={completedPlanInfo.name}
                    completionRate={completedPlanInfo.rate}
                    onUpdateProfile={handleUpdateProfile}
                    onGenerateNextPlan={handleGenerateNextPlan}
                    onViewHistory={handleViewHistory}
                />
            )}

            <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
                {/* --- 计划切换器（当同时有教练计划和自建计划时显示）--- */}
                {hasBothPlans && (
                    <div className="grid grid-cols-2 gap-2 p-1 bg-surface-50 rounded-2xl mb-6 w-full sm:w-fit border border-surface-100/50">
                        <button
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 duration-200 ease-out ${planMode === 'coach'
                                ? 'bg-surface text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                            onClick={() => setPlanMode('coach')}
                        >
                            <i className="pi pi-user mr-2" />
                            教练计划
                        </button>
                        <button
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 duration-200 ease-out ${planMode === 'self'
                                ? 'bg-surface text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                            onClick={() => setPlanMode('self')}
                        >
                            <i className="pi pi-star mr-2" />
                            我的计划
                        </button>
                    </div>
                )}
                {/* --- 顶部教练信息卡片 (仅当有订阅且当前模式为教练模式时显示) --- */}
                {loadingSubscription || (planMode === 'coach' && subscription && !subscription.coach) ? (
                    <CoachCardSkeleton />
                ) : subscription?.coach && planMode === 'coach' && (
                    <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-6 mb-8 text-surface border border-surface-100/20">
                        {/* 背景装饰图形 */}
                        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-primary-500/20 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-[-20%] left-[-5%] w-48 h-48 bg-blue-500/10 rounded-full blur-2xl"></div>

                        <div className="relative z-10 flex items-center justify-between">
                            <div className="flex items-center space-x-5">
                                <div className="relative">
                                    <Avatar
                                        label={subscription.coach.name?.charAt(0) || 'C'}
                                        image={subscription.coach.avatar_url}
                                        shape="circle"
                                        className="w-16 h-16 bg-surface text-primary-500 font-bold"
                                    ></Avatar>
                                    {/* 在线状态点 */}
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-4 border-slate-900 rounded-full"></div>
                                </div>

                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="px-2 py-0.5 bg-primary-500/20 text-primary-300 text-[10px] font-bold tracking-tight rounded">专业教练</span>
                                        <span className="text-slate-400 text-xs font-medium">为您规划训练路径</span>
                                    </div>
                                    <h2 className="text-2xl text-surface-50 font-bold tracking-tight">
                                        {subscription.coach.name || '未知教练'}
                                    </h2>
                                    <p className="text-slate-400 text-sm font-medium">
                                        {subscription.coach.title || '资深健身专家'}
                                    </p>
                                </div>
                            </div>

                            <div className="hidden md:block text-right border-l border-surface/10 pl-8">
                                <div className="text-slate-400 text-xs mb-1">训练累计</div>
                                <div className="text-xl font-mono font-bold">128 <span className="text-sm font-normal text-slate-500">天</span></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 自建计划顶部卡片 - 带移除按钮 */}
                {loadingSelfPlan && planMode === 'self' ? (
                    <SelfPlanCardSkeleton />
                ) : instance?.source === 'self' && (
                    <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-6 mb-8 text-surface border border-surface-100/20">
                        {/* 背景装饰图形 */}
                        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-primary-500/20 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-[-20%] left-[-5%] w-48 h-48 bg-pink-500/10 rounded-full blur-2xl"></div>

                        <div className="relative z-10 flex items-center justify-between">
                            <div className="flex items-center space-x-5">
                                <div className="relative">
                                    <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3">
                                        <span className="text-2xl font-black">
                                            我
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] font-bold tracking-tight rounded">自建计划</span>
                                        <span className="text-slate-400 text-xs font-medium">您的个人训练之旅</span>
                                    </div>
                                    <h2 className="text-2xl font-bold tracking-tight">
                                        {instance.name || '我的自建计划'}
                                    </h2>
                                    <p className="text-slate-400 text-sm font-medium">
                                        自我驱动，超越极限
                                    </p>
                                </div>
                            </div>

                            {/* 移除计划按钮 */}
                            <div className="flex items-center gap-2">
                                <Button
                                    icon="pi pi-trash"
                                    className="p-button-text p-button-danger"
                                    tooltip="移除此计划"
                                    tooltipOptions={{ position: 'left' }}
                                    onClick={confirmRemovePlan}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* --- 核心内容区域 --- */}
                <div className="space-y-10">
                    {/* 今日模块标题层 */}
                    <section>
                        <div className="flex items-end justify-between mb-6 px-2">
                            <div>
                                <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                                    今日任务
                                </h3>
                                <p className="text-slate-500 text-sm">
                                    {todayCompleted
                                        ? `✅ 今日训练已完成 · 下一个训练日: 第${todayDayIndex}天`
                                        : `训练日 ${todayDayIndex} · ${executionStatus === 'completed' ? '已完成' : '进行中'}`
                                    }
                                </p>
                            </div>
                            <div className={`hidden sm:flex items-center gap-2 font-bold text-sm px-3 py-1 rounded-full ${todayCompleted
                                ? 'text-green-600 bg-green-50'
                                : 'text-primary-600 bg-primary-50'
                                }`}>
                                <i className={todayCompleted ? 'pi pi-check' : 'pi pi-clock animate-spin-slow'} />
                                {todayCompleted ? '完成！' : '继续加油'}
                            </div>
                        </div>

                        {/* 卡片渲染 */}
                        <div className="transform transition-all sm:hover:translate-y-[-4px]">
                            {(() => {
                                // 根据计划类型显示对应的加载状态
                                const isLoading = (planMode === 'coach' && loadingCoachPlan) ||
                                    (planMode === 'self' && loadingSelfPlan);

                                if (isLoading) {
                                    return <TodayTrainingCardSkeleton />;
                                }

                                if (todayCompleted) {
                                    /* 今日已完成状态卡片 */
                                    return (
                                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl p-8 border border-green-100/50">
                                            <div className="text-center">
                                                <div className="text-6xl mb-4">🎉</div>
                                                <h3 className="text-2xl font-bold text-green-800 mb-2 tracking-tight">今日训练已完成!</h3>
                                                <p className="text-green-600 mb-4">
                                                    太棒了！你已经完成了今天的训练任务，好好休息，明天继续加油！
                                                </p>
                                                <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-2xl text-sm font-medium border border-green-100/50">
                                                    <i className="pi pi-calendar" />
                                                    下一个训练日: 第 {todayDayIndex} 天
                                                </div>
                                            </div>
                                        </div>
                                    );
                                } else if (todayTraining && todayTraining.type === 'training') {
                                    return (
                                        <TodayTrainingCard
                                            day={todayTraining}
                                            actions={actions}
                                            instanceId={instance.id}
                                            dayIndex={todayDayIndex}
                                            executionStatus={executionStatus}
                                            completedSets={completedSets}
                                            totalSets={totalSets}
                                        />
                                    );
                                } else {
                                    return <RestDayCard dayIndex={todayDayIndex} />;
                                }
                            })()}
                        </div>
                    </section>

                    {/* --- 浏览区域 --- */}
                    <section className="pt-4">
                        <div className="flex items-center gap-3 mb-6 px-2">
                            <div className="h-px flex-1 bg-surface-100"></div>
                            <h4 className="text-slate-400 text-xs font-bold tracking-tight">
                                浏览训练计划
                            </h4>
                            <div className="h-px flex-1 bg-surface-100"></div>
                        </div>

                        {(() => {
                            // 根据计划类型显示对应的加载状态
                            const isLoading = (planMode === 'coach' && loadingCoachPlan) ||
                                (planMode === 'self' && loadingSelfPlan);

                            if (isLoading || !instance) {
                                return <BrowseSectionSkeleton />;
                            }

                            return (
                                <BrowseSection
                                    instance={instance}
                                    actions={actions}
                                    currentDayIndex={todayDayIndex}
                                    todayExecutionStatus={executionStatus}
                                    completionDates={completionDates}
                                    todayCompleted={todayCompleted}
                                />
                            );
                        })()}
                    </section>
                </div>
            </div>

            {/* 适配 Tailwind 配置的额外样式 */}
            <style jsx global>{`
            .animate-spin-slow {
                animation: spin 3s linear infinite;
            }
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `}</style>
        </div>
    );
};

export default TodayTrainingPage;
